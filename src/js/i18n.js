import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
    en: require('../lang/en.json'),
    nl: require('../lang/nl.json')
};

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,

        keySeparator: false,

        interpolation: {
            escapeValue: false
        }
    });

export default i18n;