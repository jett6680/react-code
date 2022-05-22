/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 * @flow
 */

import {rethrowCaughtError} from 'shared/ReactErrorUtils';
import invariant from 'shared/invariant';

import {
  injectEventPluginOrder,
  injectEventPluginsByName,
  plugins,
} from './EventPluginRegistry';
import {
  executeDispatchesInOrder,
  getFiberCurrentPropsFromNode,
} from './EventPluginUtils';
import accumulateInto from './accumulateInto';
import forEachAccumulated from './forEachAccumulated';

import type {PluginModule} from './PluginModuleType';
import type {ReactSyntheticEvent} from './ReactSyntheticEventType';
import type {Fiber} from 'react-reconciler/src/ReactFiber';
import type {AnyNativeEvent} from './PluginModuleType';
import type {TopLevelType} from './TopLevelEventTypes';

/**
 * Internal queue of events that have accumulated their dispatches and are
 * waiting to have their dispatches executed.
 */
let eventQueue: ?(Array<ReactSyntheticEvent> | ReactSyntheticEvent) = null;

/**
 * Dispatches an event and releases it back into the pool, unless persistent.
 *
 * @param {?object} event Synthetic event to be dispatched.
 * @private
 */
const executeDispatchesAndRelease = function(event: ReactSyntheticEvent) {
  if (event) {
    // 执行
    executeDispatchesInOrder(event);

    if (!event.isPersistent()) {
      event.constructor.release(event);
    }
  }
};
const executeDispatchesAndReleaseTopLevel = function(e) {
  return executeDispatchesAndRelease(e);
};

function isInteractive(tag) {
  return (
    tag === 'button' ||
    tag === 'input' ||
    tag === 'select' ||
    tag === 'textarea'
  );
}

function shouldPreventMouseEvent(name, type, props) {
  switch (name) {
    case 'onClick':
    case 'onClickCapture':
    case 'onDoubleClick':
    case 'onDoubleClickCapture':
    case 'onMouseDown':
    case 'onMouseDownCapture':
    case 'onMouseMove':
    case 'onMouseMoveCapture':
    case 'onMouseUp':
    case 'onMouseUpCapture':
      return !!(props.disabled && isInteractive(type));
    default:
      return false;
  }
}

/**
 * This is a unified interface for event plugins to be installed and configured.
 *
 * Event plugins can implement the following properties:
 *
 *   `extractEvents` {function(string, DOMEventTarget, string, object): *}
 *     Required. When a top-level event is fired, this method is expected to
 *     extract synthetic events that will in turn be queued and dispatched.
 *
 *   `eventTypes` {object}
 *     Optional, plugins that fire events must publish a mapping of registration
 *     names that are used to register listeners. Values of this mapping must
 *     be objects that contain `registrationName` or `phasedRegistrationNames`.
 *
 *   `executeDispatch` {function(object, function, string)}
 *     Optional, allows plugins to override how an event gets dispatched. By
 *     default, the listener is simply invoked.
 *
 * Each plugin that is injected into `EventsPluginHub` is immediately operable.
 *
 * @public
 */

/**
 * Methods for injecting dependencies.
 */
export const injection = {
  /**
   * @param {array} InjectedEventPluginOrder
   * @public
   */
  injectEventPluginOrder,

  /**
   * @param {object} injectedNamesToPlugins Map from names to plugin modules.
   */
  injectEventPluginsByName,
};

/**
 * @param {object} inst The instance, which is the source of events.
 * @param {string} registrationName Name of listener (e.g. `onClick`).
 * @return {?function} The stored callback.
 */
export function getListener(inst: Fiber, registrationName: string) {
  let listener;

  // TODO: shouldPreventMouseEvent is DOM-specific and definitely should not
  // live here; needs to be moved to a better place soon
  const stateNode = inst.stateNode;
  if (!stateNode) {
    // Work in progress (ex: onload events in incremental mode).
    return null;
  }
  // 从DOM节点获取props
  // 因为props被设置到了dom节点的熟悉上面了
  const props = getFiberCurrentPropsFromNode(stateNode);
  if (!props) {
    // Work in progress.
    return null;
  }
  // 直接获取listener 也就是事件绑定的那个函数
  listener = props[registrationName];
  if (shouldPreventMouseEvent(registrationName, inst.type, props)) {
    return null;
  }
  invariant(
    !listener || typeof listener === 'function',
    'Expected `%s` listener to be a function, instead got a value of `%s` type.',
    registrationName,
    typeof listener,
  );
  return listener;
}

/**
 * Allows registered plugins an opportunity to extract events from top-level
 * native browser events.
 *
 * @return {*} An accumulation of synthetic events.
 * @internal
 */
// 提取event对象
function extractEvents(
  topLevelType: TopLevelType,
  targetInst: null | Fiber,
  nativeEvent: AnyNativeEvent,
  nativeEventTarget: EventTarget,
): Array<ReactSyntheticEvent> | ReactSyntheticEvent | null {
  let events = null;
  for (let i = 0; i < plugins.length; i++) {
    // Not every plugin in the ordering may be loaded at runtime.
    const possiblePlugin: PluginModule<AnyNativeEvent> = plugins[i];
    if (possiblePlugin) {
      // 执行插件上生成event对象的方法
      const extractedEvents = possiblePlugin.extractEvents(
        topLevelType,
        targetInst,
        nativeEvent,
        nativeEventTarget,
      );
      if (extractedEvents) {
        // 将注入的插件plugins遍历，然后执行extractEvents
        // 最后将生成的事件对象都汇总到一起，形成一个数组
        events = accumulateInto(events, extractedEvents);
      }
    }
  }
  // 返回生成的事件对象
  return events;
}

export function runEventsInBatch(
  events: Array<ReactSyntheticEvent> | ReactSyntheticEvent | null,
) {
  if (events !== null) {
    // 将事件形成一个队列
    eventQueue = accumulateInto(eventQueue, events);
  }

  // Set `eventQueue` to null before processing it so that we can tell if more
  // events get enqueued while processing.
  const processingEventQueue = eventQueue;
  eventQueue = null;

  if (!processingEventQueue) {
    return;
  }
  // 遍历，逐个调用 executeDispatchesAndReleaseTopLevel
  forEachAccumulated(processingEventQueue, executeDispatchesAndReleaseTopLevel);
  invariant(
    !eventQueue,
    'processEventQueue(): Additional events were enqueued while processing ' +
      'an event queue. Support for this has not yet been implemented.',
  );
  // This would be a good time to rethrow if any of the event handlers threw.
  rethrowCaughtError();
}

export function runExtractedEventsInBatch(
  topLevelType: TopLevelType,
  targetInst: null | Fiber,
  nativeEvent: AnyNativeEvent,
  nativeEventTarget: EventTarget,
) {
  // 提取时间对象
  const events = extractEvents(
    topLevelType,
    targetInst,
    nativeEvent,
    nativeEventTarget,
  );
  // 在批量中执行events
  runEventsInBatch(events);
}
