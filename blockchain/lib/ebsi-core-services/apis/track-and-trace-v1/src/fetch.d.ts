import type * as undici from "undici-types";

declare global {
  export const {
    fetch,
    FormData,
    Headers,
    Request,
    Response,
  }: typeof import("undici-types");

  type BodyInit = undici.BodyInit;
  type FormData = undici.FormData;
  type Headers = undici.Headers;
  type HeadersInit = undici.HeadersInit;
  type ReferrerPolicy = undici.ReferrerPolicy;
  type Request = undici.Request;
  type RequestCredentials = undici.RequestCredentials;
  type RequestDestination = undici.RequestDestination;
  type RequestInfo = undici.RequestInfo;
  type RequestInit = undici.RequestInit;
  type RequestMode = undici.RequestMode;
  type RequestRedirect = undici.RequestRedirect;
  type Response = undici.Response;
  type ResponseInit = undici.ResponseInit;
  type ResponseType = undici.ResponseType;
}
