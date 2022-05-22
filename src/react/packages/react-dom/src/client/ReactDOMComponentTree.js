/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {HostComponent, HostText} from 'shared/ReactWorkTags';
import invariant from 'shared/invariant';

const randomKey = Math.random()
  .toString(36)
  .slice(2);
const internalInstanceKey = '__reactInternalInstance$' + randomKey;
const internalEventHandlersKey = '__reactEventHandlers$' + randomKey;

export function precacheFiberNode(hostInst, node) {
  node[internalInstanceKey] = hostInst;
}

/**
 * Given a DOM node, return the closest ReactDOMComponent or
 * ReactDOMTextComponent instance ancestor.
 */
export function getClosestInstanceFromNode(node) {
  // 在创建完DOM节点的时候，挂在了当前的Fiber到当前的DOM上面
  // 所以在这里直接获取好了
  if (node[internalInstanceKey]) {
    return node[internalInstanceKey];
  }
  // 如果没有，会向父节点查找
  while (!node[internalInstanceKey]) {
    if (node.parentNode) {
      node = node.parentNode;
    } else {
      // Top of the tree. This node must not be part of a React tree (or is
      // unmounted, potentially).
      return null;
    }
  }

  let inst = node[internalInstanceKey];
  // 只有是一个真实的DOM节点，才返回，否则返回null
  if (inst.tag === HostComponent || inst.tag === HostText) {
    // In Fiber, this will always be the deepest root.
    return inst;
  }

  return null;
}

/**
 * Given a DOM node, return the ReactDOMComponent or ReactDOMTextComponent
 * instance, or null if the node was not rendered by this React.
 */
export function getInstanceFromNode(node) {
  const inst = node[internalInstanceKey];
  if (inst) {
    if (inst.tag === HostComponent || inst.tag === HostText) {
      return inst;
    } else {
      return null;
    }
  }
  return null;
}

/**
 * Given a ReactDOMComponent or ReactDOMTextComponent, return the corresponding
 * DOM node.
 */
export function getNodeFromInstance(inst) {
  if (inst.tag === HostComponent || inst.tag === HostText) {
    // In Fiber this, is just the state node right now. We assume it will be
    // a host component or host text.
    return inst.stateNode;
  }

  // Without this first invariant, passing a non-DOM-component triggers the next
  // invariant for a missing parent, which is super confusing.
  invariant(false, 'getNodeFromInstance: Invalid argument.');
}

export function getFiberCurrentPropsFromNode(node) {
  return node[internalEventHandlersKey] || null;
}

export function updateFiberProps(node, props) {
  node[internalEventHandlersKey] = props;
}
