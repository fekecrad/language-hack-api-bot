'use strict';

const dateFormat = require('dateformat');
const api = require('./api');

const API_RESPONSE_MESSAGES = {
	'FAILURE_FLIGHT_TICKETS': 'No flight tickets found',
	'FAILURE_HOTELS_TICKETS': 'No hotels found'
};
const API_RESPONSE_TYPES = {
	'TICKET': 'ticket',
	'TICKETS': 'tickets',
	'HOTELS': 'hotels'
}

module.exports.ai = (event, context, callback) => {
	api.callApiAi(
		event.queryStringParameters.query,
		event.queryStringParameters.sessionId
	).then((response) => {
		callback(null, {
			statusCode: 200,
			body: JSON.stringify({
				message: response.data
			})
		});
	}).catch((e) => console.log(e));
}

module.exports.analyze = (event, context, callback) => {
	const query = event.queryStringParameters.query;
	const sourceLanguage = event.queryStringParameters.lang;
	const sessionId = event.queryStringParameters.sessionId;

	api.callGoogleTranslationApi(query, sourceLanguage, 'en')
	.then(responseGoogleTranslate => api.callApiAi(responseGoogleTranslate.data.data.translations[0].translatedText, sessionId))
	.then(responseApiAi => {
		const responseEvaluation = evaluateApiAiResponse(responseApiAi);

		if (responseEvaluation.actionIncomplete) {
			api.callGoogleTranslationApi(
				responseEvaluation.message,
				'en',
				sourceLanguage
			).then(responseGoogleTranslate => {
				callback(null, createCallback(
					null,
					'message',
					responseGoogleTranslate.data.data.translations[0].translatedText,
					false
				));
			});
		} else {
			switch(responseEvaluation.action) {
				case 'find_tickets':
					runScenarioSearchFlightTickets(responseApiAi, responseEvaluation, sourceLanguage, callback);
					break;
				case 'show_ticket':
					runScenarioShowMyFilghtTicket(responseEvaluation, sourceLanguage, callback);
					break;
				case 'find_hotels':
					runScenarioSearchHotels(responseApiAi, responseEvaluation, sourceLanguage, callback);
					break;
				case 'input_unknown':
					runScenarioInputUnknown(responseEvaluation, sourceLanguage, callback);
					break;
			}
		}
	}).catch(e => console.log(e));
};

function evaluateApiAiResponse(responseApiAi) {
	return {
		action: responseApiAi.data.result.action,
		actionIncomplete: responseApiAi.data.result.actionIncomplete,
		message: responseApiAi.data.result.fulfillment.speech
	}
}

function createCallback(data, type, message, isFinal) {
	return {
		statusCode: 200,
		body: JSON.stringify({
			payload: { data, type, message, isFinal }
		}),
	}
}

function runScenarioSearchFlightTickets(responseApiAi, responseEvaluation, sourceLanguage, callback) {
	let responseKiwiFinal = null;
	const responseMessage = responseEvaluation.message;
	const responseDateText = dateFormat(responseApiAi.data.result.parameters.date, 'fullDate');

	return api.callKiwiApi(
		responseApiAi.data.result.parameters.origin,
		responseApiAi.data.result.parameters.destination,
		dateFormat(responseApiAi.data.result.parameters.date, 'dd/mm/yyyy')
	).then(responseKiwi => {
		responseKiwiFinal = responseKiwi;
		return api.callGoogleTranslationApi(
			responseKiwiFinal.data.data.length > 0 ? `${responseMessage} on ${responseDateText}` : API_RESPONSE_MESSAGES.FAILURE_FLIGHT_TICKETS,
			'en',
			sourceLanguage
		);
	}).then(responseGoogleTranslate => {
		const tickets = responseKiwiFinal.data.data.slice(0, 5).map((ticket) => ({
			arrivalTime: dateFormat(new Date(ticket.aTime * 1000), 'dd/mm hh:mm'),
			bookingToken: ticket.booking_token,
			departureTime: dateFormat(new Date(ticket.dTime * 1000), 'dd/mm hh:mm'),
			cityFrom: ticket.cityFrom,
			cityTo: ticket.cityTo,
			countryFrom: ticket.countryFrom.code,
			countryTo: ticket.countryTo.code,
			price: ticket.price,
			routes: ticket.routes,
			transfers: ticket.transfers
		}));
		callback(null, {
				statusCode: 200,
				body: JSON.stringify({
					payload: {
						data: tickets,
						type: API_RESPONSE_TYPES.TICKETS,
						message: responseGoogleTranslate.data.data.translations[0].translatedText,
						isFinal: true
					}
				}),
			});
		});
}

function runScenarioShowMyFilghtTicket(responseEvaluation, sourceLanguage, callback) {
	return api.callGoogleTranslationApi(
		responseEvaluation.message,
		'en',
		sourceLanguage
	).then((responseGoogleTranslate) => {
		callback(null, {
			statusCode: 200,
			body: JSON.stringify({
				payload: {
					data: 'some ticket data',
					type: API_RESPONSE_TYPES.TICKET,
					message: responseGoogleTranslate.data.data.translations[0].translatedText,
					isFinal: true
				}
			})
		});
	});
}

function runScenarioSearchHotels(responseApiAi, responseEvaluation, sourceLanguage, callback) {
	let responseHotelsFinal = null;
	const responseMessage = responseEvaluation.message;

	const checkIn = responseApiAi.data.result.parameters.check_in;
	const checkOut = responseApiAi.data.result.parameters.check_out;
	const destination = responseApiAi.data.result.parameters.destination;
	const guests = responseApiAi.data.result.parameters.guests;

	return api.callSygicTravelApiDestinations(destination)
	.then(responsePlaces => {
		const destination = responsePlaces.data.data.places[0];
		const destinationBoundingBox = `${destination.bounding_box.south},${destination.bounding_box.west},${destination.bounding_box.north},${destination.bounding_box.east}`;
		return api.callSygicTravelApiHotels(checkIn, checkOut, guests, destinationBoundingBox);
	}).then(responseHotels => {
		responseHotelsFinal = responseHotels;
		return api.callGoogleTranslationApi(
			responseHotelsFinal.data.data.hotels.length > 0 ? `${responseMessage}` : API_RESPONSE_MESSAGES.FAILURE_HOTELS_TICKETS,
			'en',
			sourceLanguage
		);
	}).then(responseGoogleTranslate => {
		callback(null, {
			statusCode: 200,
			body: JSON.stringify({
				payload: {
					data: responseHotelsFinal.data.data.hotels.slice(0, 5),
					type: API_RESPONSE_TYPES.HOTELS,
					message: responseGoogleTranslate.data.data.translations[0].translatedText,
					isFinal: true
				}
			})
		});
	}).catch(e => console.log(e));
}

function runScenarioInputUnknown(responseEvaluation, sourceLanguage, callback) {
	return api.callGoogleTranslationApi(
		responseEvaluation.message,
		'en',
		sourceLanguage
	).then(responseGoogleTranslate => {
		callback(null, createCallback(
			null,
			'message',
			responseGoogleTranslate.data.data.translations[0].translatedText,
			false
		));
	});
}
