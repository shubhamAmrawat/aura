import { cookies } from "next/headers";
import { DEVICE_COOKIE, parseDevice, type Device } from "./device";

/** The visitor's device choice, read from the cookie (server components only). */
export async function getDevice(): Promise<Device> {
  return parseDevice((await cookies()).get(DEVICE_COOKIE)?.value);
}
