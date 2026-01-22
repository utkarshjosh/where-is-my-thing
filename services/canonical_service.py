"""Canonical resolution service for deduplication.

Implements the utterance -> candidate -> canonical flow:
1. Normalize the utterance (strip filler words, lowercase)
2. Check vector similarity against existing canonicals
3. Return action: reuse, clarify, or create new

Thresholds:
- > 0.85: Auto-reuse (add as alias)
- 0.65-0.85: Ask clarification
- < 0.65: Create new with low confidence
"""
import re
import logging
from typing import Optional
from models import CanonicalItem, ItemType
from config import get_settings

logger = logging.getLogger(__name__)

# Filler words to strip during normalization
FILLER_WORDS = {
    "my", "the", "a", "an", "this", "that", "some",
    "thing", "stuff", "item", "object",
    "one", "old", "new"
}

# Type words that indicate item_type (strip if redundant in name)
# Aligned with UI categories: keys, books, electronics, documents, personal, home, other
TYPE_INDICATORS = {
    # Keys category
    "key": ItemType.KEYS,
    "keys": ItemType.KEYS,
    "keychain": ItemType.KEYS,
    # Books category
    "book": ItemType.BOOK,
    "novel": ItemType.BOOK,
    "textbook": ItemType.BOOK,
    "magazine": ItemType.BOOK,
    "comic": ItemType.BOOK,
    "manga": ItemType.BOOK,
    # Documents category
    "document": ItemType.DOCUMENT,
    "paper": ItemType.DOCUMENT,
    "file": ItemType.DOCUMENT,
    "passport": ItemType.DOCUMENT,
    "certificate": ItemType.DOCUMENT,
    # Electronics category
    "phone": ItemType.ELECTRONIC,
    "laptop": ItemType.ELECTRONIC,
    "charger": ItemType.ELECTRONIC,
    "cable": ItemType.ELECTRONIC,
    "electronic": ItemType.ELECTRONIC,
    "device": ItemType.ELECTRONIC,
    "tablet": ItemType.ELECTRONIC,
    "headphones": ItemType.ELECTRONIC,
    "earbuds": ItemType.ELECTRONIC,
    # Clothing -> maps to personal in UI
    "shirt": ItemType.CLOTHING,
    "pants": ItemType.CLOTHING,
    "jacket": ItemType.CLOTHING,
    "clothing": ItemType.CLOTHING,
    "clothes": ItemType.CLOTHING,
    # Tools -> maps to home in UI
    "tool": ItemType.TOOL,
    "screwdriver": ItemType.TOOL,
    "hammer": ItemType.TOOL,
    "wrench": ItemType.TOOL,
    # Personal category
    "wallet": ItemType.PERSONAL,
    "glasses": ItemType.PERSONAL,
    "watch": ItemType.PERSONAL,
    "jewelry": ItemType.PERSONAL,
    "bag": ItemType.PERSONAL,
    # Misc -> maps to other in UI
    "pen": ItemType.MISC,
    "pencil": ItemType.MISC,
}

# Similarity thresholds
THRESHOLD_AUTO_REUSE = 0.85
THRESHOLD_CLARIFY = 0.65


class CanonicalService:
    """Service for resolving utterances to canonical items."""
    
    def __init__(self, user_id: str):
        """Initialize with user_id for scoping.
        
        Args:
            user_id: The user's internal UUID
        """
        if not user_id:
            raise ValueError("user_id is required for CanonicalService")
        
        self.user_id = user_id
        self.settings = get_settings()
        
        # Lazy-loaded services
        self._driver = None
        self._memory_service = None
    
    @property
    def driver(self):
        """Lazy-load Neo4j driver."""
        if self._driver is None:
            from services.db_pool import get_neo4j_driver
            self._driver = get_neo4j_driver()
        return self._driver
    
    @property
    def memory_service(self):
        """Lazy-load memory service for embeddings."""
        if self._memory_service is None:
            from services.memory_service import MemoryService
            self._memory_service = MemoryService()
        return self._memory_service
    
    def close(self):
        """Clean up resources."""
        if self._memory_service:
            self._memory_service.close()
            self._memory_service = None
    
    def __enter__(self):
        return self
    
    def __exit__(self, *args):
        self.close()
    
    def normalize_name(self, utterance: str) -> tuple[str, Optional[ItemType]]:
        """Normalize an utterance to its canonical form.
        
        Steps:
        1. Lowercase
        2. Strip filler words
        3. Detect and extract item type
        4. Remove "by author" suffix for books
        5. Only remove redundant type suffix for long titles (3+ content words)
        
        Args:
            utterance: Raw user input like "my Crime and Punishment book"
            
        Returns:
            Tuple of (normalized_name, detected_item_type)
            e.g., ("crime and punishment", ItemType.BOOK)
        """
        # Lowercase
        text = utterance.lower().strip()
        
        # Split into words
        words = text.split()
        
        # Detect item type from type indicators
        detected_type = None
        
        for word in words:
            clean_word = re.sub(r'[^\w]', '', word)  # Remove punctuation
            if clean_word in TYPE_INDICATORS:
                detected_type = TYPE_INDICATORS[clean_word]
                break  # Use first type indicator found
        
        # Filter out filler words
        filtered_words = []
        for word in words:
            clean_word = re.sub(r'[^\w]', '', word)
            if clean_word not in FILLER_WORDS:
                filtered_words.append(word)
        
        # Remove "by [author]" patterns - do this BEFORE type word removal
        result_words = []
        for i, word in enumerate(filtered_words):
            if word == "by" and i < len(filtered_words) - 1:
                # Skip "by" and everything after (author name)
                break
            result_words.append(word)
        
        # Only remove type word if:
        # 1. It's at the END of the phrase
        # 2. The remaining content has 3+ words (titles like "Crime and Punishment")
        # This preserves: "blue pen", "laptop charger", "HDMI cable"
        # But removes: "Crime and Punishment book", "War and Peace novel"
        if detected_type and len(result_words) >= 3:
            last_word = re.sub(r'[^\w]', '', result_words[-1])
            if last_word in TYPE_INDICATORS:
                result_words = result_words[:-1]
        
        normalized = " ".join(result_words).strip()
        
        # Clean up multiple spaces and trailing punctuation
        normalized = re.sub(r'\s+', ' ', normalized)
        normalized = normalized.strip(' ,.-')
        
        # If normalization resulted in empty string, use original
        if not normalized:
            normalized = utterance.lower().strip()
        
        return normalized, detected_type
    
    def find_canonical_match(
        self, 
        normalized_name: str,
        item_type: Optional[ItemType] = None
    ) -> list[dict]:
        """Find existing canonicals that match the normalized name.
        
        Uses vector similarity search against canonical embeddings via MemoryService.
        
        Args:
            normalized_name: The normalized item name
            item_type: Optional type filter
            
        Returns:
            List of matches with canonical data and similarity scores,
            sorted by score descending
        """
        # Use MemoryService for canonical similarity search
        results = self.memory_service.canonical_similarity_search(
            query=normalized_name,
            user_id=self.user_id,
            limit=5,
            min_score=0.5
        )
        
        # Filter by item_type if specified
        if item_type:
            results = [
                r for r in results 
                if r.get("item_type") is None or r.get("item_type") == item_type.value
            ]
        
        return results
    
    def create_canonical(
        self,
        canonical_name: str,
        item_type: Optional[ItemType] = None,
        original_utterance: Optional[str] = None,
        confidence: float = 0.5
    ) -> CanonicalItem:
        """Create a new canonical item.
        
        Args:
            canonical_name: The normalized canonical name
            item_type: Optional item type
            original_utterance: The original user utterance (added as first alias)
            confidence: Initial confidence (default 0.5)
            
        Returns:
            The created CanonicalItem
        """
        # Build aliases list
        aliases = []
        if original_utterance:
            normalized_utterance = original_utterance.lower().strip()
            if normalized_utterance != canonical_name.lower():
                aliases.append(normalized_utterance)
        
        # Create the canonical item model
        canonical = CanonicalItem(
            user_id=self.user_id,
            canonical_name=canonical_name,
            item_type=item_type,
            aliases=aliases,
            confidence=confidence
        )
        
        # Create node in Neo4j (without embedding initially)
        with self.driver.session() as session:
            session.run("""
                CREATE (c:CanonicalItem {
                    id: $id,
                    user_id: $user_id,
                    canonical_name: $canonical_name,
                    item_type: $item_type,
                    aliases: $aliases,
                    confidence: $confidence,
                    created_at: datetime(),
                    updated_at: datetime()
                })
            """,
                id=canonical.id,
                user_id=self.user_id,
                canonical_name=canonical.canonical_name,
                item_type=item_type.value if item_type else None,
                aliases=canonical.aliases,
                confidence=confidence
            )
        
        # Build embedding text and embed via MemoryService
        embedding_text = self._build_canonical_embedding_text(
            canonical_name, item_type, aliases
        )
        self.memory_service.embed_canonical(canonical.id, embedding_text)
        
        logger.info(f"Created canonical '{canonical_name}' with confidence {confidence}")
        return canonical
    
    def _build_canonical_embedding_text(
        self,
        canonical_name: str,
        item_type: Optional[ItemType],
        aliases: list[str]
    ) -> str:
        """Build embedding text for a canonical item."""
        text = f"{canonical_name}"
        if item_type:
            text += f" ({item_type.value})"
        if aliases:
            text += f". Also known as: {', '.join(aliases)}"
        return text
    
    def add_alias_to_canonical(self, canonical_id: str, alias: str) -> None:
        """Add a new alias to an existing canonical.
        
        Args:
            canonical_id: The canonical item's ID
            alias: The alias to add
        """
        alias_lower = alias.lower().strip()
        
        with self.driver.session() as session:
            # Add alias if not already present
            session.run("""
                MATCH (c:CanonicalItem {id: $id, user_id: $user_id})
                WHERE NOT $alias IN c.aliases
                SET c.aliases = c.aliases + $alias,
                    c.updated_at = datetime()
            """,
                id=canonical_id,
                user_id=self.user_id,
                alias=alias_lower
            )
            
            # Get updated canonical data for re-embedding
            result = session.run("""
                MATCH (c:CanonicalItem {id: $id, user_id: $user_id})
                RETURN c.canonical_name as name, c.item_type as type, c.aliases as aliases
            """, id=canonical_id, user_id=self.user_id)
            
            record = result.single()
            if record:
                # Re-embed with updated aliases via MemoryService
                item_type = ItemType(record['type']) if record['type'] else None
                embedding_text = self._build_canonical_embedding_text(
                    record['name'],
                    item_type,
                    list(record['aliases'] or [])
                )
                self.memory_service.embed_canonical(canonical_id, embedding_text)
        
        logger.info(f"Added alias '{alias}' to canonical {canonical_id}")
    
    def boost_confidence(self, canonical_id: str, amount: float = 0.1) -> float:
        """Increase confidence for a canonical item.
        
        Args:
            canonical_id: The canonical item's ID
            amount: Amount to increase (default 0.1)
            
        Returns:
            New confidence value
        """
        with self.driver.session() as session:
            result = session.run("""
                MATCH (c:CanonicalItem {id: $id, user_id: $user_id})
                SET c.confidence = CASE 
                    WHEN c.confidence + $amount > 1.0 THEN 1.0 
                    ELSE c.confidence + $amount 
                END,
                c.updated_at = datetime()
                RETURN c.confidence as confidence
            """,
                id=canonical_id,
                user_id=self.user_id,
                amount=amount
            )
            record = result.single()
            return record["confidence"] if record else 0.5
    
    def resolve_or_create(
        self,
        utterance: str,
        item_type: Optional[ItemType] = None
    ) -> dict:
        """Main entry point: resolve an utterance to a canonical item.
        
        This is the core deduplication logic:
        1. Normalize the utterance
        2. Find similar existing canonicals
        3. Return appropriate action based on similarity
        
        Args:
            utterance: Raw user input (e.g., "Crime and Punishment book by Dostoevsky")
            item_type: Optional explicit item type
            
        Returns:
            dict with:
            - action: "reuse" | "clarify" | "create"
            - canonical_id: ID of canonical (for reuse)
            - canonical_name: Name of canonical
            - confidence: Confidence score
            - candidates: List of candidates (for clarify)
            - similarity: Match similarity score
        """
        # Step 1: Normalize
        normalized_name, detected_type = self.normalize_name(utterance)
        final_type = item_type or detected_type
        
        logger.debug(f"Normalized '{utterance}' -> '{normalized_name}' (type: {final_type})")
        
        # Step 2: Find matches
        matches = self.find_canonical_match(normalized_name, final_type)
        
        if not matches:
            # No matches - create new canonical
            canonical = self.create_canonical(
                canonical_name=normalized_name,
                item_type=final_type,
                original_utterance=utterance,
                confidence=0.5
            )
            return {
                "action": "create",
                "canonical_id": canonical.id,
                "canonical_name": canonical.canonical_name,
                "item_type": final_type.value if final_type else None,
                "confidence": 0.5,
                "message": f"Created new item '{normalized_name}'"
            }
        
        # Check top match
        top_match = matches[0]
        similarity = top_match["score"]
        
        if similarity >= THRESHOLD_AUTO_REUSE:
            # High similarity - auto-reuse
            # Add the utterance as an alias if different
            self.add_alias_to_canonical(top_match["id"], utterance)
            self.boost_confidence(top_match["id"], 0.05)
            
            return {
                "action": "reuse",
                "canonical_id": top_match["id"],
                "canonical_name": top_match["canonical_name"],
                "item_type": top_match["item_type"],
                "confidence": top_match["confidence"],
                "similarity": similarity,
                "message": f"Matched existing item '{top_match['canonical_name']}'"
            }
        
        elif similarity >= THRESHOLD_CLARIFY:
            # Medium similarity - ask for clarification
            candidates = [
                {
                    "id": m["id"],
                    "name": m["canonical_name"],
                    "type": m["item_type"],
                    "similarity": m["score"]
                }
                for m in matches[:3]  # Top 3 candidates
            ]
            
            return {
                "action": "clarify",
                "candidates": candidates,
                "normalized_name": normalized_name,
                "item_type": final_type.value if final_type else None,
                "top_match": top_match["canonical_name"],
                "similarity": similarity,
                "message": f"Is this the same as '{top_match['canonical_name']}'?"
            }
        
        else:
            # Low similarity - create new
            canonical = self.create_canonical(
                canonical_name=normalized_name,
                item_type=final_type,
                original_utterance=utterance,
                confidence=0.5
            )
            return {
                "action": "create",
                "canonical_id": canonical.id,
                "canonical_name": canonical.canonical_name,
                "item_type": final_type.value if final_type else None,
                "confidence": 0.5,
                "message": f"Created new item '{normalized_name}'"
            }
    
    def confirm_match(self, canonical_id: str, utterance: str) -> dict:
        """Confirm that an utterance matches an existing canonical.
        
        Called when user confirms during clarification flow.
        
        Args:
            canonical_id: The confirmed canonical's ID
            utterance: The original utterance
            
        Returns:
            dict with canonical details
        """
        # Add as alias and boost confidence
        self.add_alias_to_canonical(canonical_id, utterance)
        new_confidence = self.boost_confidence(canonical_id, 0.1)
        
        with self.driver.session() as session:
            result = session.run("""
                MATCH (c:CanonicalItem {id: $id, user_id: $user_id})
                RETURN c.canonical_name as name, c.item_type as type
            """, id=canonical_id, user_id=self.user_id)
            
            record = result.single()
            if record:
                return {
                    "action": "confirmed",
                    "canonical_id": canonical_id,
                    "canonical_name": record["name"],
                    "item_type": record["type"],
                    "confidence": new_confidence,
                    "message": f"Confirmed match with '{record['name']}'"
                }
        
        return {"action": "error", "message": "Canonical not found"}
    
    def reject_match_and_create(
        self,
        utterance: str,
        item_type: Optional[ItemType] = None
    ) -> dict:
        """User rejected the match - create a new canonical.
        
        Called when user says the suggested match is different.
        
        Args:
            utterance: The original utterance
            item_type: Optional item type
            
        Returns:
            dict with new canonical details
        """
        normalized_name, detected_type = self.normalize_name(utterance)
        final_type = item_type or detected_type
        
        canonical = self.create_canonical(
            canonical_name=normalized_name,
            item_type=final_type,
            original_utterance=utterance,
            confidence=0.6  # Slightly higher since user confirmed it's new
        )
        
        return {
            "action": "created",
            "canonical_id": canonical.id,
            "canonical_name": canonical.canonical_name,
            "item_type": final_type.value if final_type else None,
            "confidence": 0.6,
            "message": f"Created new item '{normalized_name}'"
        }
    
    def get_canonical_by_id(self, canonical_id: str) -> Optional[dict]:
        """Get a canonical item by ID.
        
        Args:
            canonical_id: The canonical's ID
            
        Returns:
            Canonical data dict or None
        """
        with self.driver.session() as session:
            result = session.run("""
                MATCH (c:CanonicalItem {id: $id, user_id: $user_id})
                RETURN c.id as id,
                       c.canonical_name as canonical_name,
                       c.item_type as item_type,
                       c.aliases as aliases,
                       c.confidence as confidence
            """, id=canonical_id, user_id=self.user_id)
            
            record = result.single()
            return dict(record) if record else None
    
    def find_things_for_canonical(self, canonical_id: str) -> list[dict]:
        """Find all Things linked to a canonical item.
        
        Args:
            canonical_id: The canonical's ID
            
        Returns:
            List of Thing data dicts
        """
        with self.driver.session() as session:
            result = session.run("""
                MATCH (t:Thing {user_id: $user_id})-[:CANONICAL]->(c:CanonicalItem {id: $id})
                OPTIONAL MATCH (t)-[:LOCATED_IN]->(p:Place)
                RETURN t.id as id,
                       t.name as name,
                       t.description as description,
                       p.name as location
            """, id=canonical_id, user_id=self.user_id)
            
            return [dict(r) for r in result]
