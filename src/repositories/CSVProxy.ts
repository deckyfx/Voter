
import ProxyProviderBase from "./ProxyProviderBase";
import ProxyConfig from "../models/ProxyConfig";
import Util from "../Util";
import * as _ from "lodash";
import * as fs from "fs";
import * as Papa from "papaparse";

export default class CSVProxy extends ProxyProviderBase {
    protected url = "";

    protected parse(doc: Document): Promise<Array<ProxyConfig>> {
        return new Promise<Array<ProxyConfig>>( (resolve, reject) => {
            // Parse local CSV file
            Papa.parse(fs.readFileSync("./caches/proxylist.csv").toString(), {
                complete: (results) => {
                    Util.vorpal.log(`[PROXY] ${Util.clc.green("SUCCESS")} Obtained ${results.data.length} active Proxies`);
                    resolve(results.data as Array<ProxyConfig>);
                },
                header: true,
            });
        });
    }
}
