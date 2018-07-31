import Util from "../Util";
import ProxyConfig from "../models/ProxyConfig";
import * as rp from "request-promise-native";
import { JSDOM } from "jsdom";

export default abstract class ProxyProviderBase {
    protected abstract get url(): string;
    protected abstract parse(doc?: Document): Promise<Array<ProxyConfig>>;

    public getProxyList(): Promise<Array<ProxyConfig>> {
        if (this.url.length === 0) {
            return this.parse();
        }
        Util.vorpal.log("[PROXY] Collecting Proxy list");
        Util.spinner.start();
        let _rp = rp.defaults({jar: true});
        return _rp({
            headers: {
                // tslint:disable-next-line:max-line-length
                "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.68 Safari/537.36",
            },
            method: "GET",
            uri: this.url,
        }).then((htmlString: string) => {
            Util.spinner.stop();
            const dom = new JSDOM(htmlString);
            const document = dom.window.document;
            return this.parse(document);
        });
    }
}
