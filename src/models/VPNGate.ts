export default class VPNGate {
    public country?: string;
    public country_flag?: string;
    public ddns?: string;
    public ip?: string;
    public isphost?: string;
    public session?: number;
    public uptimes?: number; // in hours
    public total_user?: number;
    public line_quality?: number; // in Mb/s
    public ping?: number; // in ms
    public total_transfer?: number; // in GB
    public loging_policy?: number; // in hours
    public config_page_url?: string;
    public config_file_urls?: Array<string>;
    public config_files?: any;
    public tcp?: number;
    public udp?: number;
    public operator_name?: string;
    public score?: number;
    public fqdn?: string;
    public sid?: number;
    public hid?: number;
}
