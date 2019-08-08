import React, { Component } from "react";
import ReactDOM from "react-dom";
import Scanner from "./Scanner.jsx";
import ServerStatus from "./ServerStatus.jsx";
import { Trans } from "react-i18next";
import { xml2js } from "xml-js";

class AirSane extends Component {

    static AIRSANE_HOSTS = require('../../hosts.json');

    constructor(props) {
        super(props);
        this.state = {
            hosts: {},
            block: false,
            currentUUID: null,
            currentPort: null,
            currentHost: null
        };
        this.onActivity = this.onActivity.bind(this);
    }

    componentDidMount() {
        this.loadHosts();
    }

    componentDidUpdate(prevProps, prevState, snapshot) {
        if (!this.getDevice(this.state.currentHost, this.state.currentPort, this.state.currentUUID) &&
                this.getDevices().length > 0) {
            this.setState({
                block: false,
                currentUUID: this.getDevices()[0]["uuid"],
                currentHost: this.getDevices()[0]["host"],
                currentPort: this.getDevices()[0]["port"]
            })
        }
    }

    loadHosts() {
        let hosts = this.state.hosts;
        AirSane.AIRSANE_HOSTS.forEach(item => {
            if (!hosts[item.host]) {
                hosts[item.host] = {
                    "error": false,
                    "port": item.port,
                    "version": null,
                    "devices": []
                };
                this.setState({
                    hosts: hosts
                });
            }
            this.loadHost(item);
        });
    }

    loadHost(host) {
        fetch("http://" + host.host + ":" + host.port + "/", {}).then(response => {
            if (response.status < 200 || response.status > 299) {
                return Promise.reject(response);
            }
            return response.text();
        }).then(result => {
            const data = xml2js(result, {compact: true});

            let devices = data["airsane:Server"]["airsane:Devices"]["airsane:Device"];
            if (!Array.isArray(data["airsane:Server"]["airsane:Devices"]["airsane:Device"])) {
                devices = [data["airsane:Server"]["airsane:Devices"]["airsane:Device"]];
            }
            if (!data["airsane:Server"]["airsane:Devices"]["airsane:Device"]) {
                devices = []
            }

            const hosts = this.state.hosts;
            hosts[host.host] = {
                "error": false,
                "port": host.port,
                "version": data["airsane:Server"]["airsane:Version"],
                "devices": devices
            };
            this.setState({
                hosts: hosts
            });
            setTimeout(() => this.loadHost(host), 10000);
        }).catch(result => {
            const hosts = this.state.hosts;
            hosts[host.host] = {
                "error": true,
                "port": host.port,
                "version": null,
                "devices": []
            };
            this.setState({
                hosts: hosts
            });
            setTimeout(() => this.loadHost(host), 10000);
        });
    }

    getConnectedHosts() {
        const connected = [];
        Object.keys(this.state.hosts).forEach(host => {
            if (!!this.state.hosts[host]["version"]) {
                connected.push(host);
            }
        });
        return connected;
    }

    getDevices() {
        const devices = [];
        Object.keys(this.state.hosts).forEach(host => {
            this.state.hosts[host]["devices"].forEach(device => {
                devices.push({
                    "name": device["airsane:Name"] ? device["airsane:Name"]["_text"] : device["pwg:MakeAndModel"]["_text"],
                    "host": host,
                    "port": this.state.hosts[host]["port"],
                    "uuid": device["scan:UUID"]["_text"]
                })
            });
        });
        return devices;
    }

    getDevice(host, port, uuid) {
        const devices = this.getDevices();
        for (let i = 0; i < devices.length; i++) {
            if (devices[i]["uuid"] === uuid && devices[i]["host"] === host && devices[i]["port"] === port) {
                return devices[i];
            }
        }
        return null;
    }

    onItemClick(device) {
        if (this.state.blocked) {
            return;
        }
        this.setState({
            currentUUID: device["uuid"],
            currentHost: device["host"]
        });
    }

    onActivity(block) {
        this.setState({
            blocked: block
        });
    }

    renderMenu() {
        let menu = [];
        this.getDevices().forEach(item => {
            menu.push(<li key={item["host"] + "_" + item["uuid"]} className="nav-item">
                <a className={"nav-link" +
                        (this.state.currentUUID === item["uuid"] && this.state.currentPort === item["port"] && this.state.currentHost === item["host"] ? " active" : "") +
                        (this.state.blocked ? " disabled" : "")}
                   href="#" onClick={() => this.onItemClick(item)}>
                    {item["name"]}
                </a>
            </li>)
        });
        return <ul className="nav nav-tabs">
            {menu}
        </ul>;
    }

    renderContents() {
        if (this.getConnectedHosts().length === 0) {
            return <p className="text-center">
                <Trans i18nKey="messageNoConnection">Still looking for an AirSane enabled server. Are you connected to a HeliumNet network?</Trans>
            </p>
        } else if (this.getDevices().length === 0) {
            return <p className="text-center">
                <Trans i18nKey="messageNoDevices">There are no devices available at this time.</Trans>
            </p>
        } else {
            return this.renderMenu();
        }
    }

    render() {
        let scanner = null;
        if (this.getDevice(this.state.currentHost, this.state.currentPort, this.state.currentUUID)) {
            scanner = <Scanner host={this.state.currentHost} port={this.state.currentPort}
                               uuid={this.state.currentUUID} activity={this.onActivity} />
        }
        return (
            <div>
                <ServerStatus hosts={this.state.hosts} connected={this.getConnectedHosts()}
                              device={this.getDevice(this.state.currentHost, this.state.currentPort,
                                  this.state.currentUUID)} />
                {this.renderContents()}
                {scanner}
            </div>
        );
    }

}

export default AirSane;

const wrapper = document.getElementById("airsane");
wrapper ? ReactDOM.render(<AirSane />, wrapper) : false;