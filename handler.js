'use strict';

const axios = require('axios');
const config = require('./config');

module.exports.analyze = (event, context, callback) => {
	const query = event.queryStringParameters.query;
	const sourceLanguage = event.queryStringParameters.lang;

	axios({
		method: 'post',
		url: 'https://translation.googleapis.com/language/translate/v2',
		params: {
			q: query,
			source: sourceLanguage,
			target: 'en',
			format: 'text',
			key: config.googleTranslateKey
		}
	}).then((responseGoogleTranslate) => {
		const queryInTargetLang = responseGoogleTranslate.data.data.translations[0].translatedText
		return axios({
		method: 'get',
		url: 'https://api.wit.ai/message',
		headers: {'Authorization': config.witAiKey},
		params: {
			v: '11.10.2017',
			q: queryInTargetLang
		}
	})
	}).then((responseWitAi) => {

		const response = {
			statusCode: 200,
			body: JSON.stringify({
				message: responseWitAi.data,
			}),
		};

		callback(null, response);
	});

};
