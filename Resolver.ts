import {IContext, raceContext} from "hlandau.Context";
import * as dns from "dns";
import {promisify} from "typed-promisify";

const async$dns$lookup = promisify(
  (hostname: string, options: {all?: boolean}, cb: (err: Error | null, res: {address: string}[]) => void) => {
    return (dns.lookup as any)(hostname, options, cb); });


/* RESOLUTION
 *****************************************************************************
 * Facilities for name resolution.
 */

export interface ILookupHostResult {
  // List of IPv4 and IPv6 addresses.
  addrs: string[];
}

export interface IResolver {
  lookupHost(ctx: IContext, host: string): Promise<ILookupHostResult>;
}

class Resolver implements IResolver {
  async lookupHost(ctx: IContext, host: string): Promise<ILookupHostResult> {
    const addrs = await raceContext(ctx, () => async$dns$lookup(host, {all: true}));
    return {addrs: addrs.map((x: any) => x.address as string)};
  }
}

export let resolver: IResolver = new Resolver();

export function lookupHost(ctx: IContext, host: string): Promise<ILookupHostResult> {
  return resolver.lookupHost(ctx, host);
}
