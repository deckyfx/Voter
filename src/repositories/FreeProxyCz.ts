import ProxyProviderBase from "./ProxyProviderBase";
import ProxyConfig from "../models/ProxyConfig";
import Util from "../Util";
import * as _ from "lodash";

export default class FreeProxyCz extends ProxyProviderBase {
    protected url = "http://free-proxy.cz/en/proxylist/country/all/http/ping/alll";

    protected parse(doc: Document): Promise<Array<ProxyConfig>> {
        const trs = doc.querySelectorAll("table#proxy_list tbody tr");
        let results: Array<ProxyConfig> = new Array<ProxyConfig>();
        for (let tr of trs) {
            let texts = tr.textContent!
                .split(/[\)\n|\s]/)
                .map((component) => { return component.trim(); })
                .filter((component) => { return component.length > 0; });
            let proxy = new ProxyConfig();
            proxy.ip = texts[1];
            proxy.port = parseInt(texts[2], undefined);
            proxy.location = `${texts[5]}, ${texts[4]}, ${texts[3]}`;
            proxy.country_flag = "";
            // @ts-ignore
            proxy.ping = parseInt(texts[10], undefined);
            proxy.type = [ texts[2] ];
            proxy.anonymity = texts[6];
            // @ts-ignore
            proxy.lastcheck = Util.moment.duration(parseInt(texts[12], undefined), texts[13]).as("minute");
            results.push(proxy);
        }
        Util.vorpal.log(`[PROXY] ${Util.clc.green("SUCCESS")} Obtained ${results.length} active Proxies`);
        return Promise.resolve( _.orderBy(results, "ping", "asc" ) );
    }
}
