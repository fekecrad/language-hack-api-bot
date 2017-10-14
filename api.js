'use strict';

const axios = require('axios');
const config = require('./config');

module.exports = {
	callGoogleTranslationApi: (query, sourceLanguage, targetLanguage) => {
		if (sourceLanguage === targetLanguage) {
			return new Promise(resolve => {
				resolve({
					data: {
						data: {
							translations: [{
								translatedText: query
							}]
						}
					}
				});
			});
		}
		return axios({
			method: 'post',
			url: 'https://translation.googleapis.com/language/translate/v2',
			params: {
				q: query,
				source: sourceLanguage,
				target: targetLanguage,
				format: 'text',
				key: config.googleTranslateKey,
				model: 'nmt'
			}
		})
	},
	callKiwiApi: (origin, destination, date) => (
		axios({
			method: 'get',
			url: 'https://api.skypicker.com/flights',
			params: {
				flyFrom: origin,
				to: destination,
				dateFrom: date,
				dateTo: date
			}
		})
	),
	callApiAi: (query, sessionId) => (
		axios({
			method: 'post',
			url: 'https://api.api.ai/v1/query?v=20150910',
			headers: { 'Authorization': 'Bearer ' + config.apiAiKey },
			data: {
				query,
				sessionId
			}
		})
	),
	callSygicTravelApiDestinations: (query) => (
		axios({
			method: 'get',
			url: 'https://api.sygictraveldata.com/v2.4/en/places/list',
			params: {
				api_key: config.sygicTravelApiKey,
				search: query,
				levels: 'city'
			}
		})
	),
	callSygicTravelApiHotels: (checkIn, checkOut, guests, bounds) => (
		axios({
			method: 'get',
			url: 'https://api.sygictraveldata.com/v2.4/en/hotels/list',
			params: {
				api_key: config.sygicTravelApiKey,
				adults: guests,
				bounds,
				check_in: checkIn,
				check_out: checkOut,
				limit: 10
			}
		})
	)
}



