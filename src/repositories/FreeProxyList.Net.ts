import ProxyProviderBase from "./ProxyProviderBase";
import ProxyConfig from "../models/ProxyConfig";
import Util from "../Util";
import * as _ from "lodash";

export default class FreeProxyListNet extends ProxyProviderBase {
    protected url = "https://free-proxy-list.net/";

    protected parse(doc: Document): Promise<Array<ProxyConfig>> {
        const trs = doc.querySelectorAll("table.table.table-striped.table-bordered tbody tr");
        let results: Array<ProxyConfig> = new Array<ProxyConfig>();
        for (let tr of trs) {
            let rows = tr.querySelectorAll("td");
            let proxy = new ProxyConfig();
            proxy.ip = rows[0].textContent!;
            proxy.port = parseInt(rows[1].textContent!, undefined);
            proxy.location = rows[3].textContent!;
            proxy.country_flag = "";
            // @ts-ignore
            proxy.ping = 0;
            proxy.type = (rows[6].textContent!.toLowerCase() === "yes") ? ["HTTP"] : [ "HTTPS"];
            proxy.anonymity = rows[4].textContent!;
            let lastchecktexts = rows[7].textContent!.split(/\s/i);
            // @ts-ignore
            proxy.lastcheck = Util.moment.duration(parseInt(lastchecktexts[0], undefined), lastchecktexts[1]).as("minute");
            results.push(proxy);
        }
        Util.vorpal.log(`[PROXY] ${Util.clc.green("SUCCESS")} Obtained ${results.length} active Proxies`);
        return Promise.resolve( _.orderBy(results, "ping", "asc" ) );
    }
}
