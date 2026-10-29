/**
 * Tree utilities for hierarchical parent_id structures (categories, warehouse zones).
 */

/**
 * Builds a nested N-ary tree from flat items with id and parent_id
 */
export function buildHierarchyTree(flatList, idKey = 'id', parentKey = 'parent_id') {
  const itemMap = new Map();
  const roots = [];

  // First pass: create nodes with empty children array
  for (const item of flatList) {
    itemMap.set(item[idKey], { ...item, children: [] });
  }

  // Second pass: attach children to parents or roots
  for (const item of flatList) {
    const node = itemMap.get(item[idKey]);
    const parentId = item[parentKey];

    if (parentId && itemMap.has(parentId)) {
      itemMap.get(parentId).children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

/**
 * Recursive Depth-First Traversal (DFS)
 */
export function traverseTreeDFS(tree, callback, depth = 0) {
  for (const node of tree) {
    callback(node, depth);
    if (node.children && node.children.length > 0) {
      traverseTreeDFS(node.children, callback, depth + 1);
    }
  }
}

/**
 * Collects all descendant IDs of a given root parent ID
 */
export function getDescendantIds(flatList, rootId, idKey = 'id', parentKey = 'parent_id') {
  const childrenMap = new Map();
  for (const item of flatList) {
    const pId = item[parentKey];
    if (!childrenMap.has(pId)) {
      childrenMap.set(pId, []);
    }
    childrenMap.get(pId).push(item[idKey]);
  }

  const descendants = [];
  const queue = [rootId];

  while (queue.length > 0) {
    const current = queue.shift();
    const children = childrenMap.get(current) || [];
    for (const childId of children) {
      descendants.push(childId);
      queue.push(childId);
    }
  }

  return descendants;
}
