import React, { Component } from "react";
import ReactCrop from 'react-image-crop';
import { Dropdown } from "bootstrap.native";
import { xml2js } from "xml-js";
import { Translation } from 'react-i18next';

class Scanner extends Component {

    static allPaperSizes = [
        { key: "paper_size_a4_portrait", width: 2480, height: 3508 },
        { key: "paper_size_a4_landscape", width: 3508, height: 2480 },
        { key: "paper_size_a5_portrait", width: 1748, height: 2480 },
        { key: "paper_size_a5_landscape", width: 2480, height: 1748 },
        { key: "paper_size_a6_portrait", width: 1240, height: 1748 },
        { key: "paper_size_a6_landscape", width: 1748, height: 1240 },
        { key: "paper_size_us_letter", width: 2550, height: 3300 },
        { key: "paper_size_us_legal", width: 2550, height: 4200 }
    ];

    constructor(props) {
        super(props);
        this.state = {
            error: false,
            capabilities: null,
            source: null,
            intent: null,
            colorMode: null,
            documentFormat: null,
            resolution: null,
            previewLoading: false,
            previewUri: null,
            previewError: false,
            scanLoading: false,
            scanError: false,
            crop: null
        };
        this.timer = null;
        this.setSourceOption = this.setSourceOption.bind(this);
        this.setIntentOption = this.setIntentOption.bind(this);
        this.setColorModeOption = this.setColorModeOption.bind(this);
        this.setDocumentFormatOption = this.setDocumentFormatOption.bind(this);
        this.setResolutionOption = this.setResolutionOption.bind(this);
        this.setPaperSizeOption = this.setPaperSizeOption.bind(this);
        this.setCropSelection = this.setCropSelection.bind(this);
        this.onPreviewLoaded = this.onPreviewLoaded.bind(this);
        this.onPreviewFailed = this.onPreviewFailed.bind(this);
    }

    componentDidMount() {
        this.getStatus();
        this.getCapabilities();
        this.timer = setInterval(() => {
            this.getStatus();
        }, 1000);
    }

    componentWillUnmount() {
        if (this.timer) {
            clearInterval(this.timer);
        }
    }

    componentDidUpdate(prevProps, prevState, snapshot) {
        if (prevProps.uuid !== this.props.uuid || prevProps.host !== this.props.host || prevProps.port !== this.props.port) {
            if (this.timer) {
                clearInterval(this.timer);
            }
            this.getCapabilities();
            this.getStatus();
            this.setState({
                previewLoading: false,
                previewUri: null,
                previewError: false,
                scanLoading: false,
                scanError: false,
                crop: null
            });
            this.timer = setInterval(() => {
                this.getStatus();
            }, 1000);
        }
    }

    getCapabilities() {
        this.setState({
            error: false
        });
        fetch("http://" + this.props.host + ":" + this.props.port + "/" + this.props.uuid + "/ScannerCapabilities", {}).then((response) => {
            if (response.status < 200 || response.status > 299) {
                return Promise.reject(response);
            }
            return response.text();
        }).then(result => {
            const data = xml2js(result, {compact: true, nativeType: true});
            const source = Scanner.checkSourceOption(data["scan:ScannerCapabilities"], this.state.source);
            this.setState({
                capabilities: data["scan:ScannerCapabilities"],
                error: false,
                source: source,
                intent: Scanner.checkIntentOption(data["scan:ScannerCapabilities"], source, this.state.intent),
                colorMode: Scanner.checkColorModeOption(data["scan:ScannerCapabilities"], source, this.state.colorMode),
                documentFormat: Scanner.checkDocumentFormatOption(data["scan:ScannerCapabilities"], source, this.state.documentFormat),
                resolution: Scanner.checkResolutionOption(data["scan:ScannerCapabilities"], source, this.state.resolution),
            }, () => {
                if (this.state.source === "Platen") {
                    //this.getPreview();
                }
            });
        }).catch(result => {
            this.setState({
                capabilities: null,
                error: true
            });
        });
    }

    getStatus() {
        fetch("http://" + this.props.host + ":" + this.props.port + "/" + this.props.uuid + "/ScannerStatus", {}).then((response) => {
            if (response.status < 200 || response.status > 299) {
                return Promise.reject(response);
            }
            return response.text();
        }).then(result => {
            const data = xml2js(result, {compact: true});
            this.setState({
                status: data["scan:ScannerStatus"],
                error: false
            });
        }).catch(result => {
            this.setState({
                status: null,
                error: true
            });
        });
    }

    static getJobSpec(x, y, w, h, res, source, intent, colorMode, documentFormat) {
        return "<x:ContentRegionUnits>escl:ThreeHundredthsOfInches</x:ContentRegionUnits>" +
            "<x:InputSource>" + source + "</x:InputSource>" +
            "<x:XResolution>" + res + "</x:XResolution>" +
            "<x:YResolution>" + res + "</x:YResolution>" +
            "<x:XOffset>" + x + "</x:XOffset>" +
            "<x:YOffset>" + y + "</x:YOffset>" +
            "<x:Width>" + w + "</x:Width>" +
            "<x:Height>" + h + "</x:Height>" +
            "<x:Intent>" + intent + "</x:Intent>" +
            "<x:ColorMode>" + colorMode + "</x:ColorMode>" +
            "<x:DocumentFormat>" + documentFormat + "</x:DocumentFormat>"
    }

    getJob(jobSpec) {
        return fetch("http://" + this.props.host + ":" + this.props.port + "/" + this.props.uuid + "/ScanJobs", {
            method: 'POST',
            body: jobSpec
        }).then((response) => {
            if (response.status < 200 || response.status > 299) {
                return Promise.reject(response);
            }
            this.getStatus();
            return Promise.resolve(response);
        });
    }

    deleteJob(jobUri) {
        return fetch("http://" + this.props.host + ":" + this.props.port + jobUri, {
            method: 'DELETE'
        }).then((response) => {
            if (response.status < 200 || response.status > 299) {
                return Promise.reject(response);
            }
            this.getStatus();
            return Promise.resolve(response);
        });
    }

    getPreview() {
        if (this.state.status && this.state.status["pwg:State"]["_text"] !== "Idle") {
            return;
        }
        this.props.activity(true);
        this.setState({
            previewUri: null,
            previewError: false,
            previewLoading: true,
            crop: null
        });
        const res = Math.min.apply(null, Scanner.getResolutionOptionValues(this.state.capabilities, this.state.source));
        let intent = this.state.intent;
        if (Scanner.getIntentOptionValues(this.state.capabilities, this.state.source, true).indexOf("Preview") >= 0) {
            intent = "Preview";
        }
        let documentFormat = this.state.documentFormat;
        if (Scanner.getDocumentFormatOptionValues(this.state.capabilities, this.state.source).indexOf("image/jpeg") >= 0) {
            documentFormat = "image/jpeg";
        }
        const w = Scanner.getSourceOptionCaps(this.state.capabilities, this.state.source)["scan:MaxWidth"]["_text"];
        const h = Scanner.getSourceOptionCaps(this.state.capabilities, this.state.source)["scan:MaxHeight"]["_text"];
        const data = Scanner.getJobSpec(0, 0, w, h, res, this.state.source, intent, this.state.colorMode, documentFormat);
        this.getJob(data).then(response => {
            const previewUri = response.headers.get("location");
            this.setState({
                previewError: false,
                previewLoading: true,
                previewUri: previewUri,
                crop: {
                    unit: '%',
                    x: 0,
                    y: 0,
                    width: 100,
                    height: 100
                }
            });
        }).catch(result => {
            this.setState({
                previewError: true,
                previewLoading: false,
                previewUri: null,
                crop: null
            });
            this.props.activity(false);
        });
    }

    getScan() {
        if (this.state.status && this.state.status["pwg:State"]["_text"] !== "Idle") {
            return;
        }
        this.props.activity(true);
        this.setState({
            scanLoading: true,
            scanError: false
        });
        const caps = Scanner.getSourceOptionCaps(this.state.capabilities, this.state.source);
        let x = 0;
        let y = 0;
        let w = caps["scan:MaxWidth"]["_text"];
        let h = caps["scan:MaxHeight"]["_text"];
        if (this.state.crop) {
            x = (this.state.crop.x * caps["scan:MaxWidth"]["_text"]) / 100;
            y = (this.state.crop.y * caps["scan:MaxHeight"]["_text"]) / 100;
            w = (this.state.crop.width * caps["scan:MaxWidth"]["_text"]) / 100;
            h = (this.state.crop.height * caps["scan:MaxHeight"]["_text"]) / 100;
        }
        const data = Scanner.getJobSpec(x, y, w, h, this.state.resolution, this.state.source,
            this.state.intent, this.state.colorMode, this.state.documentFormat);
        this.getJob(data).then(response => {
            this.getScanFile(response.headers.get("location"),
                "scan" + Scanner.renderDocumentFormatOptionExt(this.state.documentFormat),
                this.state.documentFormat);
        }).catch(result => {
            this.setState({
                scanLoading: false,
                scanError: true
            });
        });
    }

    getScanFile(location, name, mime_type) {
        fetch("http://" + this.props.host + ":" + this.props.port + location + "/NextDocument", {
            method: 'GET'
        }).then(response => {
            if (response.status < 200 || response.status > 299) {
                return Promise.reject(response);
            }
            return response.blob();
        }).then(blob => {
            require("downloadjs")(blob, name, mime_type);
            this.setState({
                scanLoading: false,
                scanError: false
            });
            this.props.activity(false);
        }).catch(result => {
            this.setState({
                scanLoading: false,
                scanError: true
            });
            this.props.activity(false);
        });
    }

    isProcessing() {
        return this.state.previewLoading || this.state.scanLoading || (this.state.status && this.state.status["pwg:State"]["_text"] !== "Idle");
    }

    static renderDropdown(ref) {
        if (ref) {
            new Dropdown(ref);
        }
    }

    static getSourceOptionCaps(capabilities, source) {
        if (source === "Platen") {
            return capabilities["scan:Platen"]["scan:PlatenInputCaps"];
        } else if(source === "Feeder") {
            if (!capabilities["scan:Adf"]["scan:AdfSimplexInputCaps"]) {
                return capabilities["scan:Adf"]["scan:AdfDuplexInputCaps"];
            } else {
                return capabilities["scan:Adf"]["scan:AdfSimplexInputCaps"];
            }
        }
        return null;
    }

    static checkSourceOption(capabilities, current) {
        let option = current;
        if (option === "Platen" && !capabilities["scan:Platen"]) {
            option = null;
        } else if (option === "Feeder" && !capabilities["scan:Adf"]) {
            option = null;
        } else if (!option && !!capabilities["scan:Platen"]) {
            option = "Platen";
        } else if (!option && !!capabilities["scan:Adf"]) {
            option = "Feeder";
        }
        return option;
    }

    setSourceOption(event) {
        this.setState({
            source: Scanner.checkSourceOption(this.state.capabilities, event.target.value)
        });
    }

    renderSourceOption() {
        let options = [];
        if (!!this.state.capabilities["scan:Platen"]) {
            options.push(<label key="Platen" className={"btn btn-secondary" +
                    (this.state.source === "Platen" ? " active" : "") +
                    (this.isProcessing() ? " disabled" : "")}>
                <input type="radio" name="source-option" id="source-platen" autoComplete="off"
                       value="Platen" onChange={this.setSourceOption} disabled={this.isProcessing()}
                       checked={this.state.source === "Platen"} />
                <Translation>
                    {(t, { i18n }) => t("option_scanning_source_flatbed")}
                </Translation>
            </label>)
        }
        if (!!this.state.capabilities["scan:Adf"]) {
            options.push(<label key="Adf" className={"btn btn-secondary" +
                    (this.state.source === "Feeder" ? " active" : "") +
                    (this.isProcessing() ? " disabled" : "")}>
                <input type="radio" name="source-option" id="source-adf" autoComplete="off"
                       value="Feeder" onChange={this.setSourceOption} disabled={this.isProcessing()}
                       checked={this.state.source === "Feeder"} />
                <Translation>
                    {(t, { i18n }) => this.state.capabilities["scan:Adf"]["scan:AdfSimplexInputCaps"] ? t("option_scanning_source_non_duplex_adf") : t("option_scanning_source_duplex_adf")}
                </Translation>
            </label>)
        }
        if (options.length < 2) {
            return null;
        }
        return <div className="option-card" key="source-option">
            <div className="card-body">
                <label>
                    <Translation>
                        {(t, { i18n }) => t("option_scanning_source_label")}
                    </Translation>
                </label><br />
                <div className="btn-group btn-group-toggle" data-toggle="buttons">
                    {options}
                </div>
            </div>
        </div>
    }

    static getIntentOptionValues(capabilities, source, includePreview) {
        let values = [];
        const caps = Scanner.getSourceOptionCaps(capabilities, source);
        if (Array.isArray(caps["scan:SupportedIntents"]["scan:SupportedIntent"])) {
            caps["scan:SupportedIntents"]["scan:SupportedIntent"].forEach(intent => {
                values.push(intent["_text"]);
            });
        } else if(caps["scan:SupportedIntents"]["scan:SupportedIntent"]) {
            values.push(caps["scan:SupportedIntents"]["scan:SupportedIntent"]["_text"]);
        }
        if (!includePreview && values.indexOf("Preview") >= 0) {
            values.splice(values.indexOf("Preview"), 1);
        }
        return values;
    }

    static checkIntentOption(capabilities, source, current) {
        let option = current;
        const values = Scanner.getIntentOptionValues(capabilities, source, false);
        if (values.length === 0) {
            option = null;
        } else if (values.indexOf(current) < 0) {
            option = values[0];
        } else if (current === "Preview") {
            option = values[0];
        }
        return option;
    }

    setIntentOption(event) {
        this.setState({
            intent: Scanner.checkIntentOption(this.state.capabilities, this.state.source, event.target.value)
        });
    }

    renderIntentOptionName(item) {
        switch (item) {
            case "Photo": return <Translation>
                {(t, { i18n }) => t("option_document_type_photo")}
            </Translation>;
            case "TextAndGraphic": return <Translation>
                {(t, { i18n }) => t("option_document_type_text_and_graphic")}
            </Translation>;
            default: return item;
        }
    }

    renderIntentOption() {
        let options = [];
        const values = Scanner.getIntentOptionValues(this.state.capabilities, this.state.source, false);
        values.forEach(item => {
            options.push(<label key={item} className={"btn btn-secondary" +
                    (this.state.intent === item ? " active" : "") +
                    (this.isProcessing() ? " disabled" : "")}>
                <input type="radio" name="intent-option" id={"intent-" + item} autoComplete="off"
                       value={item} onChange={this.setIntentOption} disabled={this.isProcessing()}
                       checked={this.state.intent === item} /> {this.renderIntentOptionName(item)}
            </label>)
        });
        if (options.length < 2) {
            return null;
        }
        return <div className="option-card" key="intent-option">
            <div className="card-body">
                <label>
                    <Translation>
                        {(t, { i18n }) => t("option_document_type_label")}
                    </Translation>
                </label><br />
                <div className="btn-group btn-group-toggle" data-toggle="buttons">
                    {options}
                </div>
            </div>
        </div>
    }

    static getSettingsProfile(capabilities, source) {
        const caps = Scanner.getSourceOptionCaps(capabilities, source);
        if (Array.isArray(caps["scan:SettingProfiles"]["scan:SettingProfile"])) {
            return caps["scan:SettingProfiles"]["scan:SettingProfile"][0];
        } else if(caps["scan:SettingProfiles"]["scan:SettingProfile"]) {
            return caps["scan:SettingProfiles"]["scan:SettingProfile"];
        }
        return null;
    }

    static getColorModeOptionValues(capabilities, source) {
        let values = [];
        const profile = Scanner.getSettingsProfile(capabilities, source);
        if (Array.isArray(profile["scan:ColorModes"]["scan:ColorMode"])) {
            profile["scan:ColorModes"]["scan:ColorMode"].forEach(mode => {
                values.push(mode["_text"]);
            });
        } else if(profile["scan:ColorModes"]["scan:ColorMode"]) {
            values.push(profile["scan:ColorModes"]["scan:ColorMode"]["_text"]);
        }
        return values;
    }

    static checkColorModeOption(capabilities, source, current) {
        let option = current;
        const values = Scanner.getColorModeOptionValues(capabilities, source);
        if (values.length === 0) {
            option = null;
        } else if (values.indexOf(current) < 0) {
            if (values.indexOf("RGB24") >= 0) {
                option = values[values.indexOf("RGB24")];
            } else if (values.indexOf("RGB48") >= 0) {
                option = values[values.indexOf("RGB48")];
            } else {
                option = values[0];
            }
        }
        return option;
    }

    setColorModeOption(event) {
        this.setState({
            colorMode: Scanner.checkColorModeOption(this.state.capabilities, this.state.source, event.target.value)
        });
    }

    renderColorModeOptionName(item) {
        switch (item) {
            case "Grayscale8": return <Translation>
                {(t, { i18n }) => t("option_color_mode_grayscale8")}
            </Translation>;
            case "Grayscale16": return <Translation>
                {(t, { i18n }) => t("option_color_mode_grayscale16")}
            </Translation>;
            case "RGB24": return <Translation>
                {(t, { i18n }) => t("option_color_mode_rgb24")}
            </Translation>;
            case "RGB48": return <Translation>
                {(t, { i18n }) => t("option_color_mode_rgb48")}
            </Translation>;
            default: return item;
        }
    }

    renderColorModeOption() {
        let options = [];
        const values = Scanner.getColorModeOptionValues(this.state.capabilities, this.state.source);
        values.forEach(item => {
            options.push(<label key={item} className={"btn btn-secondary" +
                    (this.state.colorMode === item ? " active" : "") +
                    (this.isProcessing() ? " disabled" : "")}>
                <input type="radio" name="color-mode-option" id={"color-mode-" + item} autoComplete="off"
                       value={item} onChange={this.setColorModeOption} disabled={this.isProcessing()}
                       checked={this.state.colorMode === item} /> {this.renderColorModeOptionName(item)}
            </label>)
        });
        if (options.length < 2) {
            return null;
        }
        return <div className="option-card" key="color-mode-option">
            <div className="card-body">
                <label>
                    <Translation>
                        {(t, { i18n }) => t("option_color_mode_label")}
                    </Translation>
                </label><br />
                <div className="btn-group btn-group-toggle" data-toggle="buttons">
                    {options}
                </div>
            </div>
        </div>
    }

    static getDocumentFormatOptionValues(capabilities, source) {
        let values = [];
        const profile = Scanner.getSettingsProfile(capabilities, source);
        if (Array.isArray(profile["scan:DocumentFormats"]["pwg:DocumentFormat"])) {
            profile["scan:DocumentFormats"]["pwg:DocumentFormat"].forEach(mode => {
                values.push(mode["_text"]);
            });
        } else if(profile["scan:DocumentFormats"]["pwg:DocumentFormat"]) {
            values.push(profile["scan:DocumentFormats"]["pwg:DocumentFormat"]["_text"]);
        }
        return values;
    }

    static checkDocumentFormatOption(capabilities, source, current) {
        let option = current;
        const values = Scanner.getDocumentFormatOptionValues(capabilities, source);
        if (values.length === 0) {
            option = null;
        } else if (values.indexOf(current) < 0) {
            if (values.indexOf("application/pdf") >= 0) {
                option = values[values.indexOf("application/pdf")];
            } else {
                option = values[0];
            }
        }
        return option;
    }

    setDocumentFormatOption(event) {
        this.setState({
            documentFormat: Scanner.checkDocumentFormatOption(this.state.capabilities, this.state.source, event.target.value)
        });
    }

    static renderDocumentFormatOptionExt(item) {
        switch (item) {
            case "application/pdf": return ".pdf";
            case "image/jpeg": return ".jpg";
            case "image/png": return ".png";
            default: return "";
        }
    }

    renderDocumentFormatOptionName(item) {
        switch (item) {
            case "application/pdf": return <Translation>
                {(t, { i18n }) => t("option_output_format_pdf")}
            </Translation>;
            case "image/jpeg": return <Translation>
                {(t, { i18n }) => t("option_output_format_jpeg")}
            </Translation>;
            case "image/png": return <Translation>
                {(t, { i18n }) => t("option_output_format_png")}
            </Translation>;
            default: return item;
        }
    }

    renderDocumentFormatOption() {
        let options = [];
        const values = Scanner.getDocumentFormatOptionValues(this.state.capabilities, this.state.source);
        values.forEach(item => {
            options.push(<label key={item} className={"btn btn-secondary" +
                    (this.state.documentFormat === item ? " active" : "") +
                    (this.isProcessing() ? " disabled" : "")}>
                <input type="radio" name="document-format-option" id={"document-format-" + item} autoComplete="off"
                       value={item} onChange={this.setDocumentFormatOption} disabled={this.isProcessing()}
                       checked={this.state.documentFormat === item} /> {this.renderDocumentFormatOptionName(item)}
            </label>)
        });
        if (options.length < 2) {
            return null;
        }
        return <div className="option-card" key="document-format-option">
            <div className="card-body">
                <label>
                    <Translation>
                        {(t, { i18n }) => t("option_output_format_label")}
                    </Translation>
                </label><br />
                <div className="btn-group btn-group-toggle" data-toggle="buttons">
                    {options}
                </div>
            </div>
        </div>
    }

    static getResolutionOptionValues(capabilities, source) {
        let values = [];
        let x_range = [];
        let y_range = [];
        const profile = Scanner.getSettingsProfile(capabilities, source);
        if (Array.isArray(profile["scan:SupportedResolutions"]["scan:DiscreteResolutions"]["scan:DiscreteResolution"])) {
            profile["scan:SupportedResolutions"]["scan:DiscreteResolutions"]["scan:DiscreteResolution"].forEach(mode => {
                if (mode["scan:XResolution"]["_text"] === mode["scan:YResolution"]["_text"]) {
                    values.push(mode["scan:XResolution"]["_text"]);
                }
            });
        } else if(profile["scan:SupportedResolutions"]["scan:DiscreteResolutions"]["scan:DiscreteResolution"] &&
            profile["scan:SupportedResolutions"]["scan:DiscreteResolutions"]["scan:DiscreteResolution"]["scan:XResolution"]["_text"] ===
            profile["scan:SupportedResolutions"]["scan:DiscreteResolutions"]["scan:DiscreteResolution"]["scan:YResolution"]["_text"]) {
            values.push(profile["scan:SupportedResolutions"]["scan:DiscreteResolutions"]["scan:DiscreteResolution"]["scan:XResolution"]["_text"]);
        }
        if (profile["scan:SupportedResolutions"]["scan:XResolutionRange"]) {
            let dpi = profile["scan:SupportedResolutions"]["scan:XResolutionRange"]["scan:Min"];
            while (dpi <= profile["scan:SupportedResolutions"]["scan:XResolutionRange"]["scan:Max"]) {
                x_range.push(dpi);
                dpi += profile["scan:SupportedResolutions"]["scan:XResolutionRange"]["scan:Step"]
            }
        }
        if (profile["scan:SupportedResolutions"]["scan:YResolutionRange"]) {
            let dpi = profile["scan:SupportedResolutions"]["scan:YResolutionRange"]["scan:Min"];
            while (dpi <= profile["scan:SupportedResolutions"]["scan:YResolutionRange"]["scan:Max"]) {
                y_range.push(dpi);
                dpi += profile["scan:SupportedResolutions"]["scan:YResolutionRange"]["scan:Step"]
            }
        }
        x_range.forEach(dpi => {
            if (y_range.indexOf(dpi) >= 0 && values.indexOf(dpi) < 0) {
                values.push(dpi);
            }
        });
        y_range.forEach(dpi => {
            if (x_range.indexOf(dpi) >= 0 && values.indexOf(dpi) < 0) {
                values.push(dpi);
            }
        });
        return values;
    }

    static checkResolutionOption(capabilities, source, current) {
        let option = current;
        const values = Scanner.getResolutionOptionValues(capabilities, source);
        if (values.length === 0) {
            option = null;
        } else if (values.indexOf(current) < 0) {
            if (values.indexOf(300) >= 0) {
                option = values[values.indexOf(300)];
            } else {
                option = values[0];
            }
        }
        return option;
    }

    setResolutionOption(event) {
        this.setState({
            resolution: Scanner.checkResolutionOption(this.state.capabilities, this.state.source, parseInt(event.target.value))
        });
    }

    renderResolutionOption() {
        let options = [];
        const values = Scanner.getResolutionOptionValues(this.state.capabilities, this.state.source);
        values.forEach(item => {
            options.push(<label key={item} className={"btn btn-secondary" +
                    (this.state.resolution === item ? " active" : "") +
                    (this.isProcessing() ? " disabled" : "")}>
                <input type="radio" name="resolution-option" id={"resolution-" + item} autoComplete="off"
                       value={item} onChange={this.setResolutionOption} disabled={this.isProcessing()}
                       checked={this.state.resolution === item} /> {item}
            </label>)
        });
        if (options.length < 2) {
            return null;
        }
        return <div className="option-card" key="resolution-option">
            <div className="card-body">
                <label>
                    <Translation>
                        {(t, { i18n }) => t("option_resolution_label")}
                    </Translation>
                </label><br />
                <div className="btn-group btn-group-toggle dpi" data-toggle="buttons">
                    {options}
                </div>
            </div>
        </div>
    }

    static getPaperSizeOptions(capabilities, source) {
        const caps = Scanner.getSourceOptionCaps(capabilities, source);
        const sizes = [];
        Scanner.allPaperSizes.forEach(size => {
            if (size.width <= caps["scan:MaxWidth"]["_text"] && size.height <= caps["scan:MaxHeight"]["_text"]) {
                sizes.push(size);
            }
        });
        return sizes;
    }

    setPaperSizeOption(size) {
        const caps = Scanner.getSourceOptionCaps(this.state.capabilities, this.state.source);
        const w = (size.width / caps["scan:MaxWidth"]["_text"]) * 100;
        const h = (size.height / caps["scan:MaxHeight"]["_text"]) * 100;
        this.setState({
            crop: {
                unit: '%',
                x: 0,
                y: 0,
                width: w,
                height: h
            }
        });
    }

    renderPaperSizeOption() {
        let options = [];
        let dropdownOptions = [];
        const values = Scanner.getPaperSizeOptions(this.state.capabilities, this.state.source);
        for (let i = 0; i < Math.min(values.length, 2); i++) {
            options.push(<button type="button" className="btn btn-secondary" key={values[i].key}
                                 disabled={this.isProcessing()}
                                 onClick={() => this.setPaperSizeOption(values[i])}>
                <Translation>
                    {(t, { i18n }) => t(values[i].key)}
                </Translation>
            </button>)
        }
        for (let i = 2; i < values.length; i++) {
            dropdownOptions.push(<button type="button" className="dropdown-item" key={values[i].key}
                                         disabled={this.isProcessing()}
                                         onClick={() => this.setPaperSizeOption(values[i])}>
                <Translation>
                    {(t, { i18n }) => t(values[i].key)}
                </Translation>
            </button>)
        }
        let dropdown = <div className="btn-group">
            <button ref={Scanner.renderDropdown} className="btn btn-secondary dropdown-toggle" type="button"
                    data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                More
            </button>
            <div className="dropdown-menu">
                {dropdownOptions}
            </div>
        </div>;
        if (dropdownOptions.length === 0) {
            dropdown = null;
        }
        return <div className="btn-group" role="group" aria-label="Paper sizes">
            {options}
            {dropdown}
        </div>
    }

    setCropSelection(crop, percentCrop) {
        const caps = Scanner.getSourceOptionCaps(this.state.capabilities, this.state.source);
        const w = (percentCrop.width * caps["scan:MaxWidth"]["_text"]) / 100;
        const h = (percentCrop.height * caps["scan:MaxHeight"]["_text"]) / 100;
        if (w < caps["scan:MinWidth"]["_text"]) {
            return;
        } else if(w > caps["scan:MaxWidth"]["_text"]) {
            return;
        }
        if (h < caps["scan:MinHeight"]["_text"]) {
            return;
        } else if(h > caps["scan:MaxHeight"]["_text"]) {
            return;
        }
        this.setState({
            crop: percentCrop
        });
    }

    onPreviewLoaded(image) {
        this.setState({
            previewLoading: false
        });
        this.props.activity(false);
    }

    onPreviewFailed(image) {
        this.deleteJob(this.state.previewUri).finally(() => {
            this.setState({
                previewLoading: false,
                previewUri: null,
                previewError: true
            });
            this.props.activity(false);
        });
    }

    renderPreview() {
        let image = null;
        if (!this.state.previewUri && !this.state.previewLoading) {
            let error = null;
            if(this.state.previewError) {
                error = <p>
                    <Translation>
                        {(t, { i18n }) => t("preview_error")}
                    </Translation>
                </p>;
            }
            return <div className="preview-card">
                <div className="card-body text-center">
                    {error}
                    <button type="button" className="btn btn-secondary" onClick={this.getPreview.bind(this)}
                            disabled={this.isProcessing()}>
                        <Translation>
                            {(t, { i18n }) => t("preview_scan_button")}
                        </Translation>
                    </button>
                </div>
            </div>;
        }
        if (this.state.previewUri) {
            image = <ReactCrop src={"http://" + this.props.host + ":" + this.props.port + this.state.previewUri + "/NextDocument"}
                               onChange={this.setCropSelection} crop={this.state.crop} onImageLoaded={this.onPreviewLoaded}
                               onImageError={this.onPreviewFailed} />
        }
        return <div className="preview-card">
            <div className="card-body">
                <div className="btn-toolbar justify-content-between" role="toolbar"
                     aria-label="Toolbar with button groups">
                    {this.renderPaperSizeOption()}
                    <div className="btn-group" role="group" aria-label="Preview options">
                        <button type="button" className="btn btn-secondary"
                                onClick={this.getPreview.bind(this)} disabled={this.isProcessing()}>
                            <Translation>
                                {(t, { i18n }) => t("preview_update_button")}
                            </Translation>
                        </button>
                    </div>
                </div>
                {image}
            </div>
        </div>;
    }

    renderStatus() {
        let status = <p className="status scanner">
            <span className="connecting">&nbsp;</span>&nbsp;
            <Translation>
                {(t, { i18n }) => t("scanner_status_connecting")}
            </Translation>
        </p>;
        if (this.state.error) {
            status = <p className="status scanner">
                <span className="disconnected">&nbsp;</span>&nbsp;
                <Translation>
                    {(t, { i18n }) => t("scanner_status_disconnected")}
                </Translation>
            </p>;
        } else if (this.state.status && this.state.status["pwg:State"]["_text"] === "Processing") {
            status = <p className="status scanner">
                <span className="processing">&nbsp;</span>&nbsp;
                <Translation>
                    {(t, { i18n }) => t("scanner_status_processing")}
                </Translation>
            </p>;
        } else if (this.state.previewLoading) {
            status = <p className="status scanner">
                <span className="processing">&nbsp;</span>&nbsp;
                <Translation>
                    {(t, { i18n }) => t("scanner_status_waiting_preview")}
                </Translation>
            </p>;
        } else if (this.state.scanLoading) {
            status = <p className="status scanner">
                <span className="processing">&nbsp;</span>&nbsp;
                <Translation>
                    {(t, { i18n }) => t("scanner_status_waiting_job")}
                </Translation>
            </p>;
        } else if (this.state.status && this.state.status["pwg:State"]["_text"] === "Idle") {
            status = <p className="status scanner">
                <span className="connected">&nbsp;</span>&nbsp;
                <Translation>
                    {(t, { i18n }) => t("scanner_status_ready")}
                </Translation>
            </p>;
        }
        return <div className="status-card">
            <div className="card-body">
                <div className="row align-items-center">
                    <div className="col-12 col-md-8">
                        {status}
                    </div>
                    <div className="col-12 col-md-4 text-center text-md-right">
                        <button type="button" className={"btn " + (this.state.scanError ? "btn-danger" : "btn-primary")}
                                disabled={this.isProcessing()} onClick={this.getScan.bind(this)} >
                            <Translation>
                                {(t, { i18n }) => t("scan_and_download")}
                            </Translation>
                        </button>
                    </div>
                </div>
            </div>
        </div>;
    }

    renderOptions() {
        if (!this.state.capabilities) {
            return null;
        }
        return [this.renderSourceOption(), this.renderIntentOption(), this.renderDocumentFormatOption(), this.renderResolutionOption(), this.renderColorModeOption()]
    }

    render() {
        return (
            <div className="row">
                <div className="col-12 order-md-1">
                    {this.renderStatus()}
                </div>
                <div className="col-12 col-md-6 col-lg-8 order-md-3">
                    {this.renderPreview()}
                </div>
                <div className="col-12 col-md-6 col-lg-4 order-md-2">
                    {this.renderOptions()}
                </div>
            </div>
        );
    }

}

export default Scanner;