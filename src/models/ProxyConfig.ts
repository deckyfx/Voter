export default class ProxyConfig {
    public ip?: string;
    public port?: number;
    public location?: string;
    public country_flag?: string;
    public ping?: number; // in ms
    public type?: Array<string>;
    public anonymity?: string;
    public lastcheck?: number; // in minutes
}
