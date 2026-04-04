import { check, group } from "k6";
import { get } from "k6/http";

const BASE_URL = __ENV["BASE_URL"] || "http://0.0.0.0:3000";

export const options = {
  stages: [
    { duration: "15s", target: 100 },
    { duration: "2m", target: 100 },
    { duration: "15s", target: 0 },
  ],
};

export default function loadTesting() {
  const pathname = "/estat/v1/health";

  group(pathname, () => {
    const url = `${BASE_URL}${pathname}`;
    const request = get(url);
    check(request, {
      200: (r) => r.status === 200,
      500: (r) => r.status === 500,
      other: (r) => {
        if (![200, 500].includes(r.status)) {
          return true;
        }
        return false;
      },
    });
  });
}
