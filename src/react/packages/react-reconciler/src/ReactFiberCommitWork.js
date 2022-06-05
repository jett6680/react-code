/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {
  Instance,
  TextInstance,
  SuspenseInstance,
  Container,
  ChildSet,
  UpdatePayload,
} from './ReactFiberHostConfig';
import type {Fiber} from './ReactFiber';
import type {FiberRoot} from './ReactFiberRoot';
import type {ExpirationTime} from './ReactFiberExpirationTime';
import type {CapturedValue, CapturedError} from './ReactCapturedValue';
import type {SuspenseState} from './ReactFiberSuspenseComponent';
import type {FunctionComponentUpdateQueue} from './ReactFiberHooks';
import type {Thenable} from './ReactFiberScheduler';

import {unstable_wrap as Schedule_tracing_wrap} from 'scheduler/tracing';
import {
  enableSchedulerTracing,
  enableProfilerTimer,
  enableSuspenseServerRenderer,
} from 'shared/ReactFeatureFlags';
import {
  FunctionComponent,
  ForwardRef,
  ClassComponent,
  HostRoot,
  HostComponent,
  HostText,
  HostPortal,
  Profiler,
  SuspenseComponent,
  DehydratedSuspenseComponent,
  IncompleteClassComponent,
  MemoComponent,
  SimpleMemoComponent,
} from 'shared/ReactWorkTags';
import {
  invokeGuardedCallback,
  hasCaughtError,
  clearCaughtError,
} from 'shared/ReactErrorUtils';
import {
  ContentReset,
  Placement,
  Snapshot,
  Update,
} from 'shared/ReactSideEffectTags';
import getComponentName from 'shared/getComponentName';
import invariant from 'shared/invariant';
import warningWithoutStack from 'shared/warningWithoutStack';
import warning from 'shared/warning';

import {NoWork} from './ReactFiberExpirationTime';
import {onCommitUnmount} from './ReactFiberDevToolsHook';
import {startPhaseTimer, stopPhaseTimer} from './ReactDebugFiberPerf';
import {getStackByFiberInDevAndProd} from './ReactCurrentFiber';
import {logCapturedError} from './ReactFiberErrorLogger';
import {resolveDefaultProps} from './ReactFiberLazyComponent';
import {getCommitTime} from './ReactProfilerTimer';
import {commitUpdateQueue} from './ReactUpdateQueue';
import {
  getPublicInstance,
  supportsMutation,
  supportsPersistence,
  commitMount,
  commitUpdate,
  resetTextContent,
  commitTextUpdate,
  appendChild,
  appendChildToContainer,
  insertBefore,
  insertInContainerBefore,
  removeChild,
  removeChildFromContainer,
  clearSuspenseBoundary,
  clearSuspenseBoundaryFromContainer,
  replaceContainerChildren,
  createContainerChildSet,
  hideInstance,
  hideTextInstance,
  unhideInstance,
  unhideTextInstance,
} from './ReactFiberHostConfig';
import {
  captureCommitPhaseError,
  requestCurrentTime,
  retryTimedOutBoundary,
} from './ReactFiberScheduler';
import {
  NoEffect as NoHookEffect,
  UnmountSnapshot,
  UnmountMutation,
  MountMutation,
  UnmountLayout,
  MountLayout,
  UnmountPassive,
  MountPassive,
} from './ReactHookEffectTags';
import {didWarnAboutReassigningProps} from './ReactFiberBeginWork';

let didWarnAboutUndefinedSnapshotBeforeUpdate: Set<mixed> | null = null;
if (__DEV__) {
  didWarnAboutUndefinedSnapshotBeforeUpdate = new Set();
}

const PossiblyWeakSet = typeof WeakSet === 'function' ? WeakSet : Set;

export function logError(boundary: Fiber, errorInfo: CapturedValue<mixed>) {
  const source = errorInfo.source;
  let stack = errorInfo.stack;
  if (stack === null && source !== null) {
    stack = getStackByFiberInDevAndProd(source);
  }

  const capturedError: CapturedError = {
    componentName: source !== null ? getComponentName(source.type) : null,
    componentStack: stack !== null ? stack : '',
    error: errorInfo.value,
    errorBoundary: null,
    errorBoundaryName: null,
    errorBoundaryFound: false,
    willRetry: false,
  };

  if (boundary !== null && boundary.tag === ClassComponent) {
    capturedError.errorBoundary = boundary.stateNode;
    capturedError.errorBoundaryName = getComponentName(boundary.type);
    capturedError.errorBoundaryFound = true;
    capturedError.willRetry = true;
  }

  try {
    logCapturedError(capturedError);
  } catch (e) {
    // This method must not throw, or React internal state will get messed up.
    // If console.error is overridden, or logCapturedError() shows a dialog that throws,
    // we want to report this error outside of the normal stack as a last resort.
    // https://github.com/facebook/react/issues/13188
    setTimeout(() => {
      throw e;
    });
  }
}

const callComponentWillUnmountWithTimer = function(current, instance) {
  startPhaseTimer(current, 'componentWillUnmount');
  instance.props = current.memoizedProps;
  instance.state = current.memoizedState;
  instance.componentWillUnmount();
  stopPhaseTimer();
};

// Capture errors so they don't interrupt unmounting.
function safelyCallComponentWillUnmount(current, instance) {
  if (__DEV__) {
    invokeGuardedCallback(
      null,
      callComponentWillUnmountWithTimer,
      null,
      current,
      instance,
    );
    if (hasCaughtError()) {
      const unmountError = clearCaughtError();
      captureCommitPhaseError(current, unmountError);
    }
  } else {
    try {
      callComponentWillUnmountWithTimer(current, instance);
    } catch (unmountError) {
      captureCommitPhaseError(current, unmountError);
    }
  }
}

function safelyDetachRef(current: Fiber) {
  const ref = current.ref;
  if (ref !== null) {
    if (typeof ref === 'function') {
      if (__DEV__) {
        invokeGuardedCallback(null, ref, null, null);
        if (hasCaughtError()) {
          const refError = clearCaughtError();
          captureCommitPhaseError(current, refError);
        }
      } else {
        try {
          ref(null);
        } catch (refError) {
          captureCommitPhaseError(current, refError);
        }
      }
    } else {
      ref.current = null;
    }
  }
}

function safelyCallDestroy(current, destroy) {
  if (__DEV__) {
    invokeGuardedCallback(null, destroy, null);
    if (hasCaughtError()) {
      const error = clearCaughtError();
      captureCommitPhaseError(current, error);
    }
  } else {
    try {
      destroy();
    } catch (error) {
      captureCommitPhaseError(current, error);
    }
  }
}

function commitBeforeMutationLifeCycles(
  current: Fiber | null,
  finishedWork: Fiber,
): void {
  switch (finishedWork.tag) {
    case FunctionComponent:
    case ForwardRef:
    case SimpleMemoComponent: {
      // 传入的tag UnmountSnapshot NoHookEffect
      // useEffect 和 useLayoutEffect 没有使用这两个tag
      // 所以在这个阶段， useEffect 和 useLayoutEffect 都不会被调用
      commitHookEffectList(UnmountSnapshot, NoHookEffect, finishedWork);
      return;
    }
    case ClassComponent: {
      if (finishedWork.effectTag & Snapshot) {
        if (current !== null) {
          const prevProps = current.memoizedProps;
          const prevState = current.memoizedState;
          startPhaseTimer(finishedWork, 'getSnapshotBeforeUpdate');
          const instance = finishedWork.stateNode;
          // We could update instance props and state here,
          // but instead we rely on them being set during last render.
          // TODO: revisit this when we implement resuming.
          if (__DEV__) {
            if (
              finishedWork.type === finishedWork.elementType &&
              !didWarnAboutReassigningProps
            ) {
              warning(
                instance.props === finishedWork.memoizedProps,
                'Expected %s props to match memoized props before ' +
                  'getSnapshotBeforeUpdate. ' +
                  'This might either be because of a bug in React, or because ' +
                  'a component reassigns its own `this.props`. ' +
                  'Please file an issue.',
                getComponentName(finishedWork.type) || 'instance',
              );
              warning(
                instance.state === finishedWork.memoizedState,
                'Expected %s state to match memoized state before ' +
                  'getSnapshotBeforeUpdate. ' +
                  'This might either be because of a bug in React, or because ' +
                  'a component reassigns its own `this.props`. ' +
                  'Please file an issue.',
                getComponentName(finishedWork.type) || 'instance',
              );
            }
          }
          const snapshot = instance.getSnapshotBeforeUpdate(
            finishedWork.elementType === finishedWork.type
              ? prevProps
              : resolveDefaultProps(finishedWork.type, prevProps),
            prevState,
          );
          if (__DEV__) {
            const didWarnSet = ((didWarnAboutUndefinedSnapshotBeforeUpdate: any): Set<
              mixed,
            >);
            if (snapshot === undefined && !didWarnSet.has(finishedWork.type)) {
              didWarnSet.add(finishedWork.type);
              warningWithoutStack(
                false,
                '%s.getSnapshotBeforeUpdate(): A snapshot value (or null) ' +
                  'must be returned. You have returned undefined.',
                getComponentName(finishedWork.type),
              );
            }
          }
          instance.__reactInternalSnapshotBeforeUpdate = snapshot;
          stopPhaseTimer();
        }
      }
      return;
    }
    case HostRoot:
    case HostComponent:
    case HostText:
    case HostPortal:
    case IncompleteClassComponent:
      // Nothing to do for these component types
      return;
    default: {
      invariant(
        false,
        'This unit of work tag should not have side-effects. This error is ' +
          'likely caused by a bug in React. Please file an issue.',
      );
    }
  }
}

function commitHookEffectList(
  unmountTag: number,
  mountTag: number,
  finishedWork: Fiber,
) {
  const updateQueue: FunctionComponentUpdateQueue | null = (finishedWork.updateQueue: any);
  let lastEffect = updateQueue !== null ? updateQueue.lastEffect : null;
  if (lastEffect !== null) {
    const firstEffect = lastEffect.next;
    let effect = firstEffect;
    do {
      if ((effect.tag & unmountTag) !== NoHookEffect) {
        // Unmount
        const destroy = effect.destroy;
        effect.destroy = undefined;
        if (destroy !== undefined) {
          destroy();
        }
      }
      if ((effect.tag & mountTag) !== NoHookEffect) {
        // Mount
        const create = effect.create;
        effect.destroy = create();

        if (__DEV__) {
          const destroy = effect.destroy;
          if (destroy !== undefined && typeof destroy !== 'function') {
            let addendum;
            if (destroy === null) {
              addendum =
                ' You returned null. If your effect does not require clean ' +
                'up, return undefined (or nothing).';
            } else if (typeof destroy.then === 'function') {
              addendum =
                '\n\nIt looks like you wrote useEffect(async () => ...) or returned a Promise. ' +
                'Instead, write the async function inside your effect ' +
                'and call it immediately:\n\n' +
                'useEffect(() => {\n' +
                '  async function fetchData() {\n' +
                '    // You can await here\n' +
                '    const response = await MyAPI.getData(someId);\n' +
                '    // ...\n' +
                '  }\n' +
                '  fetchData();\n' +
                `}, [someId]); // Or [] if effect doesn't need props or state\n\n` +
                'Learn more about data fetching with Hooks: https://fb.me/react-hooks-data-fetching';
            } else {
              addendum = ' You returned: ' + destroy;
            }
            warningWithoutStack(
              false,
              'An effect function must not return anything besides a function, ' +
                'which is used for clean-up.%s%s',
              addendum,
              getStackByFiberInDevAndProd(finishedWork),
            );
          }
        }
      }
      effect = effect.next;
    } while (effect !== firstEffect);
  }
}

export function commitPassiveHookEffects(finishedWork: Fiber): void {
  commitHookEffectList(UnmountPassive, NoHookEffect, finishedWork);
  commitHookEffectList(NoHookEffect, MountPassive, finishedWork);
}

function commitLifeCycles(
  finishedRoot: FiberRoot,
  current: Fiber | null,
  finishedWork: Fiber,
  committedExpirationTime: ExpirationTime,
): void {
  switch (finishedWork.tag) {
    case FunctionComponent:
    case ForwardRef:
    case SimpleMemoComponent: {
      // 传入UnmountLayout 和 MountLayout
      // useLayoutEffect具有 MountLayout的tag
      // 所以在这里 useLayoutEffect会被调用, 此时，DOM节点已经被真正的渲染到页面上
      commitHookEffectList(UnmountLayout, MountLayout, finishedWork);
      break;
    }
    case ClassComponent: {
      const instance = finishedWork.stateNode;
      if (finishedWork.effectTag & Update) {
        // 如果current是null，说明是第一次挂在 执行componentDidMount
        if (current === null) {
          startPhaseTimer(finishedWork, 'componentDidMount');
          // We could update instance props and state here,
          // but instead we rely on them being set during last render.
          // TODO: revisit this when we implement resuming.
          if (__DEV__) {
            if (
              finishedWork.type === finishedWork.elementType &&
              !didWarnAboutReassigningProps
            ) {
              warning(
                instance.props === finishedWork.memoizedProps,
                'Expected %s props to match memoized props before ' +
                  'componentDidMount. ' +
                  'This might either be because of a bug in React, or because ' +
                  'a component reassigns its own `this.props`. ' +
                  'Please file an issue.',
                getComponentName(finishedWork.type) || 'instance',
              );
              warning(
                instance.state === finishedWork.memoizedState,
                'Expected %s state to match memoized state before ' +
                  'componentDidMount. ' +
                  'This might either be because of a bug in React, or because ' +
                  'a component reassigns its own `this.props`. ' +
                  'Please file an issue.',
                getComponentName(finishedWork.type) || 'instance',
              );
            }
          }
          instance.componentDidMount();
          stopPhaseTimer();
        } else {
          // 否则执行 componentDidUpdate
          const prevProps =
            finishedWork.elementType === finishedWork.type
              ? current.memoizedProps
              : resolveDefaultProps(finishedWork.type, current.memoizedProps);
          const prevState = current.memoizedState;
          startPhaseTimer(finishedWork, 'componentDidUpdate');
          // We could update instance props and state here,
          // but instead we rely on them being set during last render.
          // TODO: revisit this when we implement resuming.
          if (__DEV__) {
            if (
              finishedWork.type === finishedWork.elementType &&
              !didWarnAboutReassigningProps
            ) {
              warning(
                instance.props === finishedWork.memoizedProps,
                'Expected %s props to match memoized props before ' +
                  'componentDidUpdate. ' +
                  'This might either be because of a bug in React, or because ' +
                  'a component reassigns its own `this.props`. ' +
                  'Please file an issue.',
                getComponentName(finishedWork.type) || 'instance',
              );
              warning(
                instance.state === finishedWork.memoizedState,
                'Expected %s state to match memoized state before ' +
                  'componentDidUpdate. ' +
                  'This might either be because of a bug in React, or because ' +
                  'a component reassigns its own `this.props`. ' +
                  'Please file an issue.',
                getComponentName(finishedWork.type) || 'instance',
              );
            }
          }
          instance.componentDidUpdate(
            prevProps,
            prevState,
            instance.__reactInternalSnapshotBeforeUpdate,
          );
          stopPhaseTimer();
        }
      }
      const updateQueue = finishedWork.updateQueue;
      // 如果updateQueue不等于null，说明在生命周期中产生了更新
      // 需要执行updateQueue
      if (updateQueue !== null) {
        if (__DEV__) {
          if (
            finishedWork.type === finishedWork.elementType &&
            !didWarnAboutReassigningProps
          ) {
            warning(
              instance.props === finishedWork.memoizedProps,
              'Expected %s props to match memoized props before ' +
                'processing the update queue. ' +
                'This might either be because of a bug in React, or because ' +
                'a component reassigns its own `this.props`. ' +
                'Please file an issue.',
              getComponentName(finishedWork.type) || 'instance',
            );
            warning(
              instance.state === finishedWork.memoizedState,
              'Expected %s state to match memoized state before ' +
                'processing the update queue. ' +
                'This might either be because of a bug in React, or because ' +
                'a component reassigns its own `this.props`. ' +
                'Please file an issue.',
              getComponentName(finishedWork.type) || 'instance',
            );
          }
        }
        // We could update instance props and state here,
        // but instead we rely on them being set during last render.
        // TODO: revisit this when we implement resuming.
        commitUpdateQueue(
          finishedWork,
          updateQueue,
          instance,
          committedExpirationTime,
        );
      }
      return;
    }
    case HostRoot: {
      const updateQueue = finishedWork.updateQueue;
      if (updateQueue !== null) {
        let instance = null;
        if (finishedWork.child !== null) {
          switch (finishedWork.child.tag) {
            case HostComponent:
              instance = getPublicInstance(finishedWork.child.stateNode);
              break;
            case ClassComponent:
              instance = finishedWork.child.stateNode;
              break;
          }
        }
        commitUpdateQueue(
          finishedWork,
          updateQueue,
          instance,
          committedExpirationTime,
        );
      }
      return;
    }
    case HostComponent: {
      const instance: Instance = finishedWork.stateNode;

      // Renderers may schedule work to be done after host components are mounted
      // (eg DOM renderer may schedule auto-focus for inputs and form controls).
      // These effects should only be committed when components are first mounted,
      // aka when there is no current/alternate.
      if (current === null && finishedWork.effectTag & Update) {
        const type = finishedWork.type;
        const props = finishedWork.memoizedProps;
        // 执行host component的一些动作
        // 比如input的focus
        commitMount(instance, type, props, finishedWork);
      }

      return;
    }
    case HostText: {
      // We have no life-cycles associated with text.
      return;
    }
    case HostPortal: {
      // We have no life-cycles associated with portals.
      return;
    }
    case Profiler: {
      if (enableProfilerTimer) {
        const onRender = finishedWork.memoizedProps.onRender;

        if (enableSchedulerTracing) {
          onRender(
            finishedWork.memoizedProps.id,
            current === null ? 'mount' : 'update',
            finishedWork.actualDuration,
            finishedWork.treeBaseDuration,
            finishedWork.actualStartTime,
            getCommitTime(),
            finishedRoot.memoizedInteractions,
          );
        } else {
          onRender(
            finishedWork.memoizedProps.id,
            current === null ? 'mount' : 'update',
            finishedWork.actualDuration,
            finishedWork.treeBaseDuration,
            finishedWork.actualStartTime,
            getCommitTime(),
          );
        }
      }
      return;
    }
    case SuspenseComponent:
      break;
    case IncompleteClassComponent:
      break;
    default: {
      invariant(
        false,
        'This unit of work tag should not have side-effects. This error is ' +
          'likely caused by a bug in React. Please file an issue.',
      );
    }
  }
}

function hideOrUnhideAllChildren(finishedWork, isHidden) {
  if (supportsMutation) {
    // We only have the top Fiber that was inserted but we need to recurse down its
    // children to find all the terminal nodes.
    let node: Fiber = finishedWork;
    while (true) {
      if (node.tag === HostComponent) {
        const instance = node.stateNode;
        if (isHidden) {
          hideInstance(instance);
        } else {
          unhideInstance(node.stateNode, node.memoizedProps);
        }
      } else if (node.tag === HostText) {
        const instance = node.stateNode;
        if (isHidden) {
          hideTextInstance(instance);
        } else {
          unhideTextInstance(instance, node.memoizedProps);
        }
      } else if (
        node.tag === SuspenseComponent &&
        node.memoizedState !== null
      ) {
        // Found a nested Suspense component that timed out. Skip over the
        // primary child fragment, which should remain hidden.
        const fallbackChildFragment: Fiber = (node.child: any).sibling;
        fallbackChildFragment.return = node;
        node = fallbackChildFragment;
        continue;
      } else if (node.child !== null) {
        node.child.return = node;
        node = node.child;
        continue;
      }
      if (node === finishedWork) {
        return;
      }
      while (node.sibling === null) {
        if (node.return === null || node.return === finishedWork) {
          return;
        }
        node = node.return;
      }
      node.sibling.return = node.return;
      node = node.sibling;
    }
  }
}

function commitAttachRef(finishedWork: Fiber) {
  const ref = finishedWork.ref;
  if (ref !== null) {
    const instance = finishedWork.stateNode;
    let instanceToUse;
    switch (finishedWork.tag) {
      case HostComponent:
        instanceToUse = getPublicInstance(instance);
        break;
      default:
        instanceToUse = instance;
    }
    if (typeof ref === 'function') {
      ref(instanceToUse);
    } else {
      if (__DEV__) {
        if (!ref.hasOwnProperty('current')) {
          warningWithoutStack(
            false,
            'Unexpected ref object provided for %s. ' +
              'Use either a ref-setter function or React.createRef().%s',
            getComponentName(finishedWork.type),
            getStackByFiberInDevAndProd(finishedWork),
          );
        }
      }

      ref.current = instanceToUse;
    }
  }
}

function commitDetachRef(current: Fiber) {
  const currentRef = current.ref;
  if (currentRef !== null) {
    if (typeof currentRef === 'function') {
      currentRef(null);
    } else {
      currentRef.current = null;
    }
  }
}

// User-originating errors (lifecycles and refs) should not interrupt
// deletion, so don't let them throw. Host-originating errors should
// interrupt deletion, so it's okay
// 执行相应的卸载，function组件执行hook的卸载
// class组件执行 componentWillUnmount 并且卸载ref等
// 真实的DOM节点卸载绑定的ref等
function commitUnmount(current: Fiber): void {
  onCommitUnmount(current);

  switch (current.tag) {
    case FunctionComponent:
    case ForwardRef:
    case MemoComponent:
    case SimpleMemoComponent: {
      const updateQueue: FunctionComponentUpdateQueue | null = (current.updateQueue: any);
      if (updateQueue !== null) {
        const lastEffect = updateQueue.lastEffect;
        if (lastEffect !== null) {
          const firstEffect = lastEffect.next;
          let effect = firstEffect;
          do {
            const destroy = effect.destroy;
            if (destroy !== undefined) {
              safelyCallDestroy(current, destroy);
            }
            effect = effect.next;
          } while (effect !== firstEffect);
        }
      }
      break;
    }
    case ClassComponent: {
      safelyDetachRef(current);
      const instance = current.stateNode;
      if (typeof instance.componentWillUnmount === 'function') {
        safelyCallComponentWillUnmount(current, instance);
      }
      return;
    }
    case HostComponent: {
      safelyDetachRef(current);
      return;
    }
    case HostPortal: {
      // TODO: this is recursive.
      // We are also not using this parent because
      // the portal will get pushed immediately.
      if (supportsMutation) {
        unmountHostComponents(current);
      } else if (supportsPersistence) {
        emptyPortalContainer(current);
      }
      return;
    }
  }
}

// 从当前节点开始，先执行当前节点的commitUnmount
// 然后在执行子节点的，如果子节点不存在，就执行兄弟节点
// 当兄弟节点不存在，在向上到父节点
// 这是一个深度优先的过程
function commitNestedUnmounts(root: Fiber): void {
  // While we're inside a removed host node we don't want to call
  // removeChild on the inner nodes because they're removed by the top
  // call anyway. We also want to call componentWillUnmount on all
  // composites before this host node is removed from the tree. Therefore
  // we do an inner loop while we're still inside the host node.
  let node: Fiber = root;
  while (true) {
    commitUnmount(node);
    // Visit children because they may contain more composite or host nodes.
    // Skip portals because commitUnmount() currently visits them recursively.
    if (
      node.child !== null &&
      // If we use mutation we drill down into portals using commitUnmount above.
      // If we don't use mutation we drill down into portals here instead.
      (!supportsMutation || node.tag !== HostPortal)
    ) {
      node.child.return = node;
      node = node.child;
      continue;
    }
    if (node === root) {
      return;
    }
    while (node.sibling === null) {
      if (node.return === null || node.return === root) {
        return;
      }
      node = node.return;
    }
    node.sibling.return = node.return;
    node = node.sibling;
  }
}

function detachFiber(current: Fiber) {
  // Cut off the return pointers to disconnect it from the tree. Ideally, we
  // should clear the child pointer of the parent alternate to let this
  // get GC:ed but we don't know which for sure which parent is the current
  // one so we'll settle for GC:ing the subtree of this child. This child
  // itself will be GC:ed when the parent updates the next time.
  current.return = null;
  current.child = null;
  current.memoizedState = null;
  current.updateQueue = null;
  const alternate = current.alternate;
  if (alternate !== null) {
    alternate.return = null;
    alternate.child = null;
    alternate.memoizedState = null;
    alternate.updateQueue = null;
  }
}

function emptyPortalContainer(current: Fiber) {
  if (!supportsPersistence) {
    return;
  }

  const portal: {containerInfo: Container, pendingChildren: ChildSet} =
    current.stateNode;
  const {containerInfo} = portal;
  const emptyChildSet = createContainerChildSet(containerInfo);
  replaceContainerChildren(containerInfo, emptyChildSet);
}

function commitContainer(finishedWork: Fiber) {
  if (!supportsPersistence) {
    return;
  }

  switch (finishedWork.tag) {
    case ClassComponent: {
      return;
    }
    case HostComponent: {
      return;
    }
    case HostText: {
      return;
    }
    case HostRoot:
    case HostPortal: {
      const portalOrRoot: {
        containerInfo: Container,
        pendingChildren: ChildSet,
      } =
        finishedWork.stateNode;
      const {containerInfo, pendingChildren} = portalOrRoot;
      replaceContainerChildren(containerInfo, pendingChildren);
      return;
    }
    default: {
      invariant(
        false,
        'This unit of work tag should not have side-effects. This error is ' +
          'likely caused by a bug in React. Please file an issue.',
      );
    }
  }
}

function getHostParentFiber(fiber: Fiber): Fiber {
  let parent = fiber.return;
  while (parent !== null) {
    if (isHostParent(parent)) {
      return parent;
    }
    parent = parent.return;
  }
  invariant(
    false,
    'Expected to find a host parent. This error is likely caused by a bug ' +
      'in React. Please file an issue.',
  );
}

function isHostParent(fiber: Fiber): boolean {
  return (
    fiber.tag === HostComponent ||
    fiber.tag === HostRoot ||
    fiber.tag === HostPortal
  );
}

// 这个方法要做的事就是：找到当前节点要插入到哪个兄弟节点之前
// 这里所指的兄弟节点是指在真实DOM树中的兄弟节点
function getHostSibling(fiber: Fiber): ?Instance {
  // We're going to search forward into the tree until we find a sibling host
  // node. Unfortunately, if multiple insertions are done in a row we have to
  // search past them. This leads to exponential search for the next sibling.
  // TODO: Find a more efficient way to do this.
  let node: Fiber = fiber;
  siblings: while (true) {
    // If we didn't find anything, let's try the next sibling.
    // 这个while循环的意思就是找到第一个存在兄弟节点的Fiber就跳出while循环
    while (node.sibling === null) {
      if (node.return === null || isHostParent(node.return)) {
        // If we pop out of the root or hit the parent the fiber we are the
        // last sibling.
        // 到了host parent节点或者root根节点，还没有找到有兄弟节点的Fiber
        // 只能退出循环了
        return null;
      }
      node = node.return;
    }
    node.sibling.return = node.return;
    // 指针指向当前节点的兄弟节点
    node = node.sibling;
    // 如果当前找到的兄弟节点不是一个具有真实DOM的Fiber节点
    // 那么就要向下查找当前节点的Child节点，直到找到真实的DOM节点
    // 或者找不到跳出循环
    while (
      node.tag !== HostComponent &&
      node.tag !== HostText &&
      node.tag !== DehydratedSuspenseComponent
    ) {
      // If it is not host node and, we might have a host node inside it.
      // Try to search down until we find one.
      if (node.effectTag & Placement) {
        // If we don't have a child, try the siblings instead.
        // 如果当前节点也是需要插入的，那么久继续当前大的循环，尝试找当前节点的兄弟节点
        continue siblings;
      }
      // If we don't have a child, try the siblings instead.
      // We also skip portals because they are not part of this host tree.
      // 如果当前节点没有孩子节点，那就只能尝试兄弟节点找了
      // 跳出本轮循环，进入大的循环，继续查找兄弟节点
      if (node.child === null || node.tag === HostPortal) {
        continue siblings;
      } else {
        // 当前节点具有孩子节点，就查找当前节点的孩子节点，
        // 继续循环，查找真实的DOM节点
        node.child.return = node;
        node = node.child;
      }
    }
    // Check if this host node is stable or about to be placed.
    // 跳出上面的循环后，说明找到了一个真实的节点,
    // 如果当前节点不需要插入，说明找到了我们想要的那个真实的DOM节点
    // 否则 还得继续大循环，查找当前节点的兄弟节点
    if (!(node.effectTag & Placement)) {
      // Found it!
      return node.stateNode;
    }
  }
}

function commitPlacement(finishedWork: Fiber): void {
  if (!supportsMutation) {
    return;
  }

  // Recursively insert all host nodes into the parent.
  // 找到真实DOM父节点对应的Fiber
  const parentFiber = getHostParentFiber(finishedWork);

  // Note: these two variables *must* always be updated together.
  let parent;
  let isContainer;

  switch (parentFiber.tag) {
    case HostComponent:
      parent = parentFiber.stateNode;
      isContainer = false;
      break;
    case HostRoot:
      parent = parentFiber.stateNode.containerInfo;
      isContainer = true;
      break;
    case HostPortal:
      parent = parentFiber.stateNode.containerInfo;
      isContainer = true;
      break;
    default:
      invariant(
        false,
        'Invalid host parent fiber. This error is likely caused by a bug ' +
          'in React. Please file an issue.',
      );
  }
  if (parentFiber.effectTag & ContentReset) {
    // Reset the text content of the parent before doing any insertions
    resetTextContent(parent);
    // Clear ContentReset from the effect tag
    parentFiber.effectTag &= ~ContentReset;
  }
  // 找到当前节点要插入在哪个真实的DOM节点之前的那个节点
  // 可能为null
  const before = getHostSibling(finishedWork);
  // We only have the top Fiber that was inserted but we need to recurse down its
  // children to find all the terminal nodes.
  let node: Fiber = finishedWork;
  while (true) {
    // 如果当前节点是一个真实的DOM节点或者文本节点
    if (node.tag === HostComponent || node.tag === HostText) {
      // 首先判断插到before节点之前的这个before节点存在不存在
      if (before) {
        // 如果这个before节点存在，并且当前节点还是一个容器节点
        if (isContainer) {
          insertInContainerBefore(parent, node.stateNode, before);
        } else {
          insertBefore(parent, node.stateNode, before);
        }
      } else {
        if (isContainer) {
          appendChildToContainer(parent, node.stateNode);
        } else {
          appendChild(parent, node.stateNode);
        }
      }
    } else if (node.tag === HostPortal) {
      // If the insertion itself is a portal, then we don't want to traverse
      // down its children. Instead, we'll get insertions from each child in
      // the portal directly.
    } else if (node.child !== null) {
      // 当前节点不是真实DOM节点的Fiber对象,并且子节点存在
      // 继续循环，找到子节点的真实DOM节点，将它插入父节点
      node.child.return = node;
      node = node.child;
      continue;
    }
    // 说明当前节点插入完了 直接返回
    if (node === finishedWork) {
      return;
    }
    // 往上查找兄弟节点存在的那个节点
    while (node.sibling === null) {
      if (node.return === null || node.return === finishedWork) {
        return;
      }
      node = node.return;
    }
    node.sibling.return = node.return;
    // 继续循环，判断兄弟节点是不是真实DOM,节点
    // 如果是，将它插入到真实的父节点
    node = node.sibling;
  }
}

// 这个过程也是一个深度优先的过程
// 优先子节点，没有的话，就兄弟节点
// 当兄弟节点和子节点都执行完，在向上到父节点
function unmountHostComponents(current): void {
  // We only have the top Fiber that was deleted but we need to recurse down its
  // children to find all the terminal nodes.
  let node: Fiber = current;

  // Each iteration, currentParent is populated with node's host parent if not
  // currentParentIsValid.
  // 标记当前的parent是否是一个真实的DOM节点
  let currentParentIsValid = false;

  // Note: these two variables *must* always be updated together.
  let currentParent;
  let currentParentIsContainer;

  while (true) {
    if (!currentParentIsValid) {
      let parent = node.return;
      // 这个循环的做的事情，其实就是向Fiber树向上查找
      // 找到最近的为真实DOM父节点节点的Fiber
      findParent: while (true) {
        invariant(
          parent !== null,
          'Expected to find a host parent. This error is likely caused by ' +
            'a bug in React. Please file an issue.',
        );
        switch (parent.tag) {
          case HostComponent:
            currentParent = parent.stateNode;
            currentParentIsContainer = false;
            break findParent;
          case HostRoot:
            currentParent = parent.stateNode.containerInfo;
            currentParentIsContainer = true;
            break findParent;
          case HostPortal:
            currentParent = parent.stateNode.containerInfo;
            currentParentIsContainer = true;
            break findParent;
        }
        parent = parent.return;
      }
      currentParentIsValid = true;
    }

    if (node.tag === HostComponent || node.tag === HostText) {
      // 提交嵌套卸载
      commitNestedUnmounts(node);
      // After all the children have unmounted, it is now safe to remove the
      // node from the tree.
      // 执行真实DOM节点的removeChild操作
      if (currentParentIsContainer) {
        removeChildFromContainer(
          ((currentParent: any): Container),
          (node.stateNode: Instance | TextInstance),
        );
      } else {
        removeChild(
          ((currentParent: any): Instance),
          (node.stateNode: Instance | TextInstance),
        );
      }
      // Don't visit children because we already visited them.
    } else if (
      enableSuspenseServerRenderer &&
      node.tag === DehydratedSuspenseComponent
    ) {
      // Delete the dehydrated suspense boundary and all of its content.
      if (currentParentIsContainer) {
        clearSuspenseBoundaryFromContainer(
          ((currentParent: any): Container),
          (node.stateNode: SuspenseInstance),
        );
      } else {
        clearSuspenseBoundary(
          ((currentParent: any): Instance),
          (node.stateNode: SuspenseInstance),
        );
      }
    } else if (node.tag === HostPortal) {
      if (node.child !== null) {
        // When we go into a portal, it becomes the parent to remove from.
        // We will reassign it back when we pop the portal on the way up.
        currentParent = node.stateNode.containerInfo;
        currentParentIsContainer = true;
        // Visit children because portals might contain host components.
        node.child.return = node;
        node = node.child;
        continue;
      }
    } else {
      commitUnmount(node);
      // Visit children because we may find more host components below.
      if (node.child !== null) {
        node.child.return = node;
        node = node.child;
        continue;
      }
    }
    if (node === current) {
      return;
    }
    while (node.sibling === null) {
      if (node.return === null || node.return === current) {
        return;
      }
      node = node.return;
      if (node.tag === HostPortal) {
        // When we go out of the portal, we need to restore the parent.
        // Since we don't keep a stack of them, we will search for it.
        currentParentIsValid = false;
      }
    }
    node.sibling.return = node.return;
    node = node.sibling;
  }
}
// 删除
function commitDeletion(current: Fiber): void {
  if (supportsMutation) {
    // Recursively delete all host nodes from the parent.
    // Detach refs and call componentWillUnmount() on the whole subtree.
    // ReactDOM走这个
    unmountHostComponents(current);
  } else {
    // Detach refs and call componentWillUnmount() on the whole subtree.
    commitNestedUnmounts(current);
  }
  // 卸载Ref
  detachFiber(current);
}

// 更新DOM节点
function commitWork(current: Fiber | null, finishedWork: Fiber): void {
  if (!supportsMutation) {
    switch (finishedWork.tag) {
      case FunctionComponent:
      case ForwardRef:
      case MemoComponent:
      case SimpleMemoComponent: {
        // Note: We currently never use MountMutation, but useLayout uses
        // UnmountMutation.
        commitHookEffectList(UnmountMutation, MountMutation, finishedWork);
        return;
      }
    }

    commitContainer(finishedWork);
    return;
  }

  switch (finishedWork.tag) {
    case FunctionComponent:
    case ForwardRef:
    case MemoComponent:
    case SimpleMemoComponent: {
      // Note: We currently never use MountMutation, but useLayout uses
      // UnmountMutation.
      // hook相关
      commitHookEffectList(UnmountMutation, MountMutation, finishedWork);
      return;
    }
    case ClassComponent: {
      return;
    }
    case HostComponent: {
      // 拿到Fiber对应的DOM
      const instance: Instance = finishedWork.stateNode;
      if (instance != null) {
        // Commit the work prepared earlier.
        const newProps = finishedWork.memoizedProps;
        // For hydration we reuse the update path but we treat the oldProps
        // as the newProps. The updatePayload will contain the real change in
        // this case.
        const oldProps = current !== null ? current.memoizedProps : newProps;
        const type = finishedWork.type;
        // TODO: Type the updateQueue to be specific to host components.
        // DOM节点接收的更新 是一个数组，i 为 key， i + 1 为value的形式
        const updatePayload: null | UpdatePayload = (finishedWork.updateQueue: any);
        finishedWork.updateQueue = null;
        if (updatePayload !== null) {
          // 提交更新
          commitUpdate(
            instance,
            updatePayload,
            type,
            oldProps,
            newProps,
            finishedWork,
          );
        }
      }
      return;
    }
    case HostText: {
      invariant(
        finishedWork.stateNode !== null,
        'This should have a text node initialized. This error is likely ' +
          'caused by a bug in React. Please file an issue.',
      );
      const textInstance: TextInstance = finishedWork.stateNode;
      const newText: string = finishedWork.memoizedProps;
      // For hydration we reuse the update path but we treat the oldProps
      // as the newProps. The updatePayload will contain the real change in
      // this case.
      const oldText: string =
        current !== null ? current.memoizedProps : newText;
      commitTextUpdate(textInstance, oldText, newText);
      return;
    }
    case HostRoot: {
      return;
    }
    case Profiler: {
      return;
    }
    case SuspenseComponent: {
      let newState: SuspenseState | null = finishedWork.memoizedState;

      let newDidTimeout;
      let primaryChildParent = finishedWork;
      if (newState === null) {
        newDidTimeout = false;
      } else {
        newDidTimeout = true;
        primaryChildParent = finishedWork.child;
        if (newState.timedOutAt === NoWork) {
          // If the children had not already timed out, record the time.
          // This is used to compute the elapsed time during subsequent
          // attempts to render the children.
          newState.timedOutAt = requestCurrentTime();
        }
      }

      if (primaryChildParent !== null) {
        hideOrUnhideAllChildren(primaryChildParent, newDidTimeout);
      }

      // If this boundary just timed out, then it will have a set of thenables.
      // For each thenable, attach a listener so that when it resolves, React
      // attempts to re-render the boundary in the primary (pre-timeout) state.
      const thenables: Set<Thenable> | null = (finishedWork.updateQueue: any);
      if (thenables !== null) {
        finishedWork.updateQueue = null;
        let retryCache = finishedWork.stateNode;
        if (retryCache === null) {
          retryCache = finishedWork.stateNode = new PossiblyWeakSet();
        }
        thenables.forEach(thenable => {
          // Memoize using the boundary fiber to prevent redundant listeners.
          let retry = retryTimedOutBoundary.bind(null, finishedWork, thenable);
          if (enableSchedulerTracing) {
            retry = Schedule_tracing_wrap(retry);
          }
          if (!retryCache.has(thenable)) {
            retryCache.add(thenable);
            thenable.then(retry, retry);
          }
        });
      }

      return;
    }
    case IncompleteClassComponent: {
      return;
    }
    default: {
      invariant(
        false,
        'This unit of work tag should not have side-effects. This error is ' +
          'likely caused by a bug in React. Please file an issue.',
      );
    }
  }
}

function commitResetTextContent(current: Fiber) {
  if (!supportsMutation) {
    return;
  }
  resetTextContent(current.stateNode);
}

export {
  commitBeforeMutationLifeCycles,
  commitResetTextContent,
  commitPlacement,
  commitDeletion,
  commitWork,
  commitLifeCycles,
  commitAttachRef,
  commitDetachRef,
};
