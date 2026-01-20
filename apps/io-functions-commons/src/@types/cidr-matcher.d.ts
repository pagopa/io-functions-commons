declare module "cidr-matcher" {
  class Matcher {
    constructor();
    // eslint-disable-next-line @typescript-eslint/unified-signatures
    constructor(classes: string[]);
    addNetworkClass(cidr: string): void;
    contains(cidr: string): boolean;
    containsAny(addrs: string[]): boolean;
    removeNetworkClass(cidr: string): void;
  }

  export = Matcher;
}
