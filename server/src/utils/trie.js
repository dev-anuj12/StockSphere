/**
 * Trie node and structure for fast prefix-based autocomplete lookup.
 */
class TrieNode {
  constructor() {
    this.children = new Map();
    this.isEndOfWord = false;
    this.data = []; // Stores products matching this word or prefix
  }
}

export class ProductTrie {
  constructor() {
    this.root = new TrieNode();
  }

  insert(word, product) {
    if (!word) return;
    const normalized = word.toLowerCase().trim();
    let current = this.root;

    for (const char of normalized) {
      if (!current.children.has(char)) {
        current.children.set(char, new TrieNode());
      }
      current = current.children.get(char);
      // Keep reference to product on the path for fast sub-tree collections
      if (!current.data.some(p => p.id === product.id)) {
        current.data.push(product);
      }
    }
    current.isEndOfWord = true;
  }

  searchPrefix(prefix, limit = 10) {
    if (!prefix) return [];
    const normalized = prefix.toLowerCase().trim();
    let current = this.root;

    for (const char of normalized) {
      if (!current.children.has(char)) {
        return [];
      }
      current = current.children.get(char);
    }

    return current.data.slice(0, limit);
  }

  clear() {
    this.root = new TrieNode();
  }
}
