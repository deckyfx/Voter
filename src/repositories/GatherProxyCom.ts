import ProxyProviderBase from "./ProxyProviderBase";
import ProxyConfig from "../models/ProxyConfig";
import Util from "../Util";
import * as _ from "lodash";
import * as fs from "fs";
import * as path from "path";

export default class GatherProxyCom extends ProxyProviderBase {
    protected url = "";

    protected parse(): Promise<Array<ProxyConfig>> {
        const proxies = fs.readFileSync(path.join(".", "caches", "proxies.txt")).toString().split(/\n/g);
        let results: Array<ProxyConfig> = new Array<ProxyConfig>();
        for (let item of proxies) {
            let texts = item.split(":");
            let proxy = new ProxyConfig();
            proxy.ip = texts[0];
            proxy.port = parseInt(texts[1], undefined);
            proxy.location = `United State`;
            proxy.country_flag = "";
            // @ts-ignore
            proxy.ping = 0;
            proxy.type = [ "HTTP" ];
            proxy.anonymity = "";
            // @ts-ignore
            proxy.lastcheck = 0;
            results.push(proxy);
        }
        Util.vorpal.log(`[PROXY] ${Util.clc.green("SUCCESS")} Obtained ${results.length} active Proxies`);
        return Promise.resolve( _.orderBy(results, "ping", "asc" ) );
    }
}
