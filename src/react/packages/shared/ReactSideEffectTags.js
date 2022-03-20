/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

export type SideEffectTag = number;

// Don't change these two values. They're used by React Dev Tools.
export const NoEffect = /*              */ 0b000000000000;
export const PerformedWork = /*         */ 0b000000000001; // 1

// You can change the rest (and add more).
export const Placement = /*             */ 0b000000000010; // 2
export const Update = /*                */ 0b000000000100; // 4
export const PlacementAndUpdate = /*    */ 0b000000000110; // 6
export const Deletion = /*              */ 0b000000001000; // 8
export const ContentReset = /*          */ 0b000000010000; // 16
export const Callback = /*              */ 0b000000100000; // 32
export const DidCapture = /*            */ 0b000001000000; // 63
export const Ref = /*                   */ 0b000010000000; // 128
export const Snapshot = /*              */ 0b000100000000; // 256
export const Passive = /*               */ 0b001000000000; // 512

// Passive & Update & Callback & Ref & Snapshot
export const LifecycleEffectMask = /*   */ 0b001110100100; // 932

// Union of all host effects
export const HostEffectMask = /*        */ 0b001111111111; // 1023

export const Incomplete = /*            */ 0b010000000000; // 1024
export const ShouldCapture = /*         */ 0b100000000000; // 2048
