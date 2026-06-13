import { HttpError } from "./http";

export function requireAutomationSecret(request: Request) {
  const expected = process.env.AUTOMATION_SECRET;
  if (!expected) {
    throw new HttpError(500, "AUTOMATION_SECRET is not configured");
  }

  const actual = request.headers.get("x-automation-secret");
  if (actual !== expected) {
    throw new HttpError(401, "Invalid automation secret");
  }
}

export function requireWebhookSecret(request: Request, envName: string) {
  const expected = process.env[envName];
  if (!expected) {
    throw new HttpError(500, `${envName} is not configured`);
  }

  const actual = request.headers.get("x-webhook-secret");
  if (actual !== expected) {
    throw new HttpError(401, "Invalid webhook secret");
  }
}
