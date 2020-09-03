// This sample demonstrates handling intents from an Alexa skill using the Alexa Skills Kit SDK (v2).
// Please visit https://alexa.design/cookbook for additional examples on implementing slots, dialog management,
// session persistence, api calls, and more.
const Alexa = require('ask-sdk-core');
const data = require('./DateScores.json');
const util = require('./util.js');

// *****************************************************************************
// HELPER FUNCTIONS FOR SSML
// *****************************************************************************
const speak = function(speech) {
    return `<speak>${speech}</speak>`;
};

const leadIn = function(name) {
    const dbName = data[name];
    const index = Math.floor(Math.random() * 5);
    
    return dbName["leadin"][index] + "<break strength='medium'/>";
};

const neutral = function(name) {
    const dbName = data[name];
    const index = Math.floor(Math.random() * 3);
    
    return dbName["neutral"][index] + "<break strength='medium' />";
};

const disliked = function(name) {
    const dbName = data[name];
    const index = Math.floor(Math.random() * 3);
    
    return dbName["disliked"][index] + "<break strength='medium' />";
};

const ask = function() {
    // TODO: vary question based on seed
    return data["questions"][0]["text"];
}
    
const GoOnDateAPIHandler = {
    
    canHandle(handlerInput) {
        return util.isApiRequest(handlerInput, 'goOnDate');
    },
    handle(handlerInput) {
        
        const apiRequest = handlerInput.requestEnvelope.request.apiRequest;
        
        let name = resolveEntity(apiRequest.slots, "va_name");
        let location = resolveEntity(apiRequest.slots, "date_location");
        
        let goOnDateResult = {};
        if (name !== null && location !== null) {
            // TODO: Do some checking so you can't call goOnDate multiple times
            const dbLocation = data[name][location];
            const datePoints = dbLocation.datePoints;
            
            goOnDateResult = speak(dbLocation.response + dbLocation.start + leadIn(name) + ask());
            
            const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

            sessionAttributes.datePoints = datePoints;
            sessionAttributes.va_name = name;
            console.log("Current date points are ", datePoints);
            
            handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
        }
        
        const response = buildSuccessApiResponse(goOnDateResult);
        console.log('GoOnDateAPIHandler', JSON.stringify(response));
        
        return response;
    }
};

const FridayNightQuestionAPIHandler = {
    
    canHandle(handlerInput) {
        return util.isApiRequest(handlerInput, 'fridayNightQuestion');
    },
    handle(handlerInput) {
        
        const apiRequest = handlerInput.requestEnvelope.request.apiRequest;
        let fri_night = resolveEntity(apiRequest.slots, "fri_night");
        
        let friNightResult = {};
        if (fri_night !== null) {
            const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
            const name = sessionAttributes.va_name;
            
            const dbFriNight = data[name]["fridayNight"][fri_night];
            const datePoints = dbFriNight.datePoints;
            
            let response = "";
            if (datePoints === 30) {
                response = dbFriNight.response;
            } else if (datePoints === 20) {
                response = neutral(name);
            } else { // (datePoints === 10)
                response = disliked(name);
            }
            
            friNightResult = speak(response + leadIn(name) + ask());

            sessionAttributes.datePoints += datePoints;
            console.log("Current date points are ", datePoints);
            
            handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
        }
        
        const response = buildSuccessApiResponse(friNightResult);
        console.log('fridayNightQuestionHandler', JSON.stringify(response));
        
        return response;
    }
};

const CheckDateStatusAPIHandler = {
    canHandle(handlerInput) {
        return util.isApiRequest(handlerInput, 'checkDateStatus');
    },
    handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    
        var datePoints = 0;
        if (sessionAttributes.datePoints) {
            datePoints = sessionAttributes.datePoints;
        }
        
        const checkDateStatusResult = datePoints;
    
        const response = buildSuccessApiResponse(checkDateStatusResult);
        console.log('CheckDateStatusAPIHandler', JSON.stringify(response));
        
        return response;
    }
};


const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput) {
        const speakOutput = 'Welcome, you can say Hello or Help. Which would you like to try?';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};
const HelloWorldIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'HelloWorldIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'Hello World!';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
            .getResponse();
    }
};
const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'You can say hello to me! How can I help?';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};
const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        const speakOutput = 'Goodbye!';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};
const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        // Any cleanup logic goes here.
        return handlerInput.responseBuilder.getResponse();
    }
};

// The intent reflector is used for interaction model testing and debugging.
// It will simply repeat the intent the user said. You can create custom handlers
// for your intents by defining them above, then also adding them to the request
// handler chain below.
const IntentReflectorHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest';
    },
    handle(handlerInput) {
        const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
        const speakOutput = `You just triggered ${intentName}`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
            .getResponse();
    }
};

// Generic error handling to capture any syntax or routing errors. If you receive an error
// stating the request handler chain is not found, you have not implemented a handler for
// the intent being invoked or included it in the skill builder below.
const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.log(`~~~~ Error handled: ${error.stack}`);
        console.log(error);
        const speakOutput = `Sorry, I had trouble doing what you asked. Please try again.`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

// *****************************************************************************
// Resolves catalog value using Entity Resolution
const resolveEntity = function(resolvedEntity, slotName) {

    //This is built in functionality with SDK Using Alexa's ER
    let erAuthorityResolution = resolvedEntity[slotName].resolutions 
        .resolutionsPerAuthority[0];
    let value = null;
    
    if (erAuthorityResolution.status.code === 'ER_SUCCESS_MATCH') {
        value = erAuthorityResolution.values[0].value.name;
    }
    
    return value;
};

// *****************************************************************************
// Formats JSON for return
// You can use the private SDK methods like "setApiResponse()", but for this template for now, we just send back
// the JSON. General request and response JSON format can be found here:
// https://developer.amazon.com/docs/custom-skills/request-and-response-json-reference.html
const buildSuccessApiResponse = (returnEntity) => { 
    return { apiResponse: returnEntity };
};

/**
 * Request Interceptor to log the request sent by Alexa
 */
const LogRequestInterceptor = {
  process(handlerInput) {
    // Log Request
    console.log("==== REQUEST ======");
    console.log(JSON.stringify(handlerInput.requestEnvelope, null, 2));
  }
}

/**
 * Response Interceptor to log the response made to Alexa
 */
const LogResponseInterceptor = {
  process(handlerInput, response) {
    // Log Response
    console.log("==== RESPONSE ======");
    console.log(JSON.stringify(response, null, 2));
  }
}

// The SkillBuilder acts as the entry point for your skill, routing all request and response
// payloads to the handlers above. Make sure any new handlers or interceptors you've
// defined are included below. The order matters - they're processed top to bottom.
exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        HelloWorldIntentHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        SessionEndedRequestHandler,
        GoOnDateAPIHandler,
        FridayNightQuestionAPIHandler,
        CheckDateStatusAPIHandler,
        IntentReflectorHandler, // make sure IntentReflectorHandler is last so it doesn't override your custom intent handlers
    )
    .addErrorHandlers(
        ErrorHandler,
    )
    .addRequestInterceptors(LogRequestInterceptor)
    .addResponseInterceptors(LogResponseInterceptor)
    .lambda();
