import { check, group } from "k6";
import { get } from "k6/http";

const BASE_URL = __ENV["BASE_URL"] || "http://0.0.0.0:3000";

export const options = {
  max_vus: 100,
  stages: [
    { duration: "15s", target: 10 },
    { duration: "2m", target: 100 },
    { duration: "15s", target: 0 },
  ],
  vus: 100,
};

export default function loadTesting() {
  group("/authorisation/v4/.well-known/openid-configuration", () => {
    const url = `${BASE_URL}/authorisation/v4/.well-known/openid-configuration`;
    const request = get(url);
    check(request, {
      Success: (r) => r.status === 200,
    });
  });
}
