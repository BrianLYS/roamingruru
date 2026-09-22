/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as catalogue from "../catalogue.js";
import type * as faces from "../faces.js";
import type * as lulu from "../lulu.js";
import type * as memory from "../memory.js";
import type * as profileFields from "../profileFields.js";
import type * as profiles from "../profiles.js";
import type * as shortlistMail from "../shortlistMail.js";
import type * as shortlistMailFields from "../shortlistMailFields.js";
import type * as sources from "../sources.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  catalogue: typeof catalogue;
  faces: typeof faces;
  lulu: typeof lulu;
  memory: typeof memory;
  profileFields: typeof profileFields;
  profiles: typeof profiles;
  shortlistMail: typeof shortlistMail;
  shortlistMailFields: typeof shortlistMailFields;
  sources: typeof sources;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
