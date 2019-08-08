import React, { Component } from "react";
import { Trans } from 'react-i18next';

class ServerStatus extends Component {

    constructor(props) {
        super(props);
    }

    render() {
        if (this.props.connected.length === 0) {
            return <p className="status server">
                <span className="connecting">&nbsp;</span>&nbsp;
                <Trans i18nKey="serviceConnecting">Searching for an AirSane enabled host...</Trans>
            </p>;
        } else if(this.props.connected.length === 1) {
            const host = this.props.connected[0];
            const rev = this.props.hosts[this.props.connected[0]]["version"]["airsane:Revision"]["_text"];
            const commitHash = this.props.hosts[this.props.connected[0]]["version"]["airsane:CommitHash"]["_text"];
            const date = this.props.hosts[this.props.connected[0]]["version"]["airsane:Date"]["_text"];
            const time = this.props.hosts[this.props.connected[0]]["version"]["airsane:Time"]["_text"];
            return <p className="status server">
                <span className="connected">&nbsp;</span>&nbsp;
                <Trans i18nKey="serviceConnected">
                    Connected to AirSane on {{host}} (Revision {{rev}} [{{commitHash}}], compiled on {{date}} {{time}}).
                </Trans>
            </p>;
        } else {
            const connected = this.props.connected.length;
            const host = this.props.device["host"];
            const rev = this.props.hosts[this.props.device["host"]]["version"]["airsane:Revision"]["_text"];
            const commitHash = this.props.hosts[this.props.device["host"]]["version"]["airsane:CommitHash"]["_text"];
            const date = this.props.hosts[this.props.device["host"]]["version"]["airsane:Date"]["_text"];
            const time = this.props.hosts[this.props.device["host"]]["version"]["airsane:Time"]["_text"];
            return <p className="status server">
                <span className="connected">&nbsp;</span>&nbsp;
                <Trans i18nKey="serviceConnectedMultiple">
                    Connected to {{connected}} AirSane hosts. Current device on {{host}} (Revision {{rev}} [{{commitHash}}], compiled on {{date}} {{time}}).
                </Trans>
            </p>;
        }
    }

}

export default ServerStatus;