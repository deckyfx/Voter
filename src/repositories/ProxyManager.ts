import ProxyProviderBase from "./ProxyProviderBase";
import Util from "../Util";
import ProxyConfig from "../models/ProxyConfig";
import * as _ from "lodash";
import FreeProxyListNet from "./FreeProxyList.Net";
import FreeProxyCz from "./FreeProxyCz";
import GatherProxyCom from "./GatherProxyCom";

export default class ProxyManager {
    private ProxySources: Array<ProxyProviderBase> = [] ;
    private Proxies: Array<ProxyConfig> = [] ;

    public constructor(...sources: ProxyProviderBase[]) {
        sources = [
            new FreeProxyListNet(),
            // new GatherProxyCom(),
        ];
        for (let source of sources) {
            this.ProxySources.push(source);
        }
    }

    private fetch(source: ProxyProviderBase): Promise<boolean> {
        return source.getProxyList()
        .then((proxies) => {
            this.Proxies = _.concat(this.Proxies, proxies);
            return Promise.resolve(true);
        });
    }

    public withAllProxies(action: (proxy: ProxyConfig) => Promise<boolean>): Promise<Array<boolean>> {
        return Util.SequencePromises<ProxyProviderBase, boolean>(this.ProxySources, this.fetch.bind(this))
        .then((results) => {
            return Util.SequencePromises<ProxyConfig, boolean>(this.Proxies, action);
        });
    }
}
