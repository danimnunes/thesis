import type { LoggerService } from "@nestjs/common";

import axios from "axios";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { setupInterceptors } from "./axiosInterceptors.ts";

axios.defaults.adapter = "http";

describe("setupInterceptors", () => {
  const mockServer = setupServer();

  beforeAll(() => {
    // Intercept network requests
    mockServer.listen({ onUnhandledRequest: "warn" });
  });

  afterEach(() => {
    mockServer.resetHandlers();

    // Remove interceptors (max 3)
    axios.interceptors.request.eject(0);
    axios.interceptors.response.eject(0);
    axios.interceptors.request.eject(1);
    axios.interceptors.response.eject(1);
    axios.interceptors.request.eject(2);
    axios.interceptors.response.eject(2);
  });

  afterAll(() => {
    mockServer.close();
  });

  it("should do nothing if the 'domain' or 'localOrigin' variable is not defined or empty", () => {
    expect.assertions(2);
    expect(setupInterceptors("", "")).toBeUndefined();
    expect(setupInterceptors("https://api-test.ebsi.eu", "")).toBeUndefined();
  });

  it("should intercept Axios requests", async () => {
    expect.assertions(1);

    setupInterceptors("https://api-test.ebsi.eu", "http://api.local");

    // Set up 2 mocked servers (local, remote)
    mockServer.use(
      http.get("http://api.local/trusted-apps-registry/v3/apps", () =>
        HttpResponse.text("local"),
      ),
      http.get("https://api-test.ebsi.eu/trusted-apps-registry/v3/apps", () =>
        HttpResponse.text("remote"),
      ),
    );

    // Query the remote server
    const response = await axios.get(
      "https://api-test.ebsi.eu/trusted-apps-registry/v3/apps",
    );

    // Expect a response from the local server
    expect(response.data).toBe("local");
  });

  it("should not call the remote server if the local server responded with a status < 500", async () => {
    expect.assertions(1);

    setupInterceptors("https://api-test.ebsi.eu", "http://api.local");

    // Set up 2 mocked servers (local, remote)
    mockServer.use(
      http.get(
        "http://api.local/trusted-apps-registry/v3/apps",
        () => new HttpResponse(undefined, { status: 401 }),
      ),
      http.get("https://api-test.ebsi.eu/trusted-apps-registry/v3/apps", () =>
        HttpResponse.text("remote"),
      ),
    );

    // Querying the remote server should be intercepted and return the 404 error from the local server
    await expect(() =>
      axios.get("https://api-test.ebsi.eu/trusted-apps-registry/v3/apps"),
    ).rejects.toThrow("Request failed with status code 401");
  });

  it("should fallback to the remote server if the local server responds with a status >= 500", async () => {
    expect.assertions(5);

    const logger = {
      debug: vi.fn(),
      verbose: vi.fn(),
    };

    setupInterceptors(
      "https://api-test.ebsi.eu",
      "http://api.local",
      logger as unknown as LoggerService,
    );

    // Set up 2 mocked servers (local, remote)
    mockServer.use(
      http.get(
        "http://api.local/trusted-apps-registry/v3/apps",
        () => new HttpResponse(undefined, { status: 500 }),
      ),
      http.get("https://api-test.ebsi.eu/trusted-apps-registry/v3/apps", () =>
        HttpResponse.text("remote"),
      ),
    );

    // Query the remote server
    const response = await axios.get(
      "https://api-test.ebsi.eu/trusted-apps-registry/v3/apps",
    );

    // Expect a response from the remote server
    expect(response.data).toBe("remote");

    // Check if the logger has been called as expected
    expect(logger.debug).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "ERR_BAD_RESPONSE",
        config: expect.objectContaining({
          headers: expect.objectContaining({
            Accept: "application/json, text/plain, */*",
            "Accept-Encoding": "gzip, compress, deflate, br",
            "EBSI-REMOTE-API": "true",
            "User-Agent": expect.stringContaining("axios/"),
          }),
          method: "get",
          url: "http://api.local/trusted-apps-registry/v3/apps",
        }),
        message: "Request failed with status code 500",
        name: "AxiosError",
        status: 500,
      }),
      "Axios Response Interceptor",
    );
    expect(logger.verbose).toHaveBeenCalledTimes(2);
    expect(logger.verbose).toHaveBeenNthCalledWith(
      1,
      "Replacing https://api-test.ebsi.eu/trusted-apps-registry/v3/apps with http://api.local/trusted-apps-registry/v3/apps",
      "Axios Request Interceptor",
    );
    expect(logger.verbose).toHaveBeenNthCalledWith(
      2,
      "Replacing http://api.local/trusted-apps-registry/v3/apps with https://api-test.ebsi.eu/trusted-apps-registry/v3/apps",
      "Axios Response Interceptor",
    );
  });

  it("should fallback to the remote server if the local server responds with a status 404 and the response is not a Problem Details error", async () => {
    expect.assertions(5);

    const logger = {
      debug: vi.fn(),
      verbose: vi.fn(),
    };

    setupInterceptors(
      "https://api-test.ebsi.eu",
      "http://api.local",
      logger as unknown as LoggerService,
    );

    // Set up 2 mocked servers (local, remote)
    mockServer.use(
      http.get("http://api.local/trusted-apps-registry/v3/apps", () =>
        HttpResponse.text("local", { status: 404 }),
      ),
      http.get("https://api-test.ebsi.eu/trusted-apps-registry/v3/apps", () =>
        HttpResponse.text("remote"),
      ),
    );

    // Query the remote server
    const response = await axios.get(
      "https://api-test.ebsi.eu/trusted-apps-registry/v3/apps",
    );

    // Expect a response from the remote server
    expect(response.data).toBe("remote");

    // Check if the logger has been called as expected
    expect(logger.debug).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "ERR_BAD_REQUEST",
        config: expect.objectContaining({
          headers: expect.objectContaining({
            Accept: "application/json, text/plain, */*",
            "Accept-Encoding": "gzip, compress, deflate, br",
            "EBSI-REMOTE-API": "true",
            "User-Agent": expect.stringContaining("axios/"),
          }),
          method: "get",
          url: "http://api.local/trusted-apps-registry/v3/apps",
        }),
        message: "Request failed with status code 404",
        name: "AxiosError",
        status: 404,
      }),
      "Axios Response Interceptor",
    );
    expect(logger.verbose).toHaveBeenCalledTimes(2);
    expect(logger.verbose).toHaveBeenNthCalledWith(
      1,
      "Replacing https://api-test.ebsi.eu/trusted-apps-registry/v3/apps with http://api.local/trusted-apps-registry/v3/apps",
      "Axios Request Interceptor",
    );
    expect(logger.verbose).toHaveBeenNthCalledWith(
      2,
      "Replacing http://api.local/trusted-apps-registry/v3/apps with https://api-test.ebsi.eu/trusted-apps-registry/v3/apps",
      "Axios Response Interceptor",
    );
  });

  it("should not call the remote server if the local server responded with a status 404 and the response is a Problem Details error", async () => {
    expect.assertions(1);

    setupInterceptors("https://api-test.ebsi.eu", "http://api.local");

    // Set up 2 mocked servers (local, remote)
    mockServer.use(
      http.get("http://api.local/trusted-apps-registry/v3/apps", () =>
        HttpResponse.json(
          {
            status: 404,
            title: "Not Found",
          },
          { status: 404 },
        ),
      ),
      http.get("https://api-test.ebsi.eu/trusted-apps-registry/v3/apps", () =>
        HttpResponse.text("remote"),
      ),
    );

    // Querying the remote server should be intercepted and return the 404 error from the local server
    await expect(() =>
      axios.get("https://api-test.ebsi.eu/trusted-apps-registry/v3/apps"),
    ).rejects.toThrow("Request failed with status code 404");
  });
});
