// This sample demonstrates handling intents from an Alexa skill using the Alexa Skills Kit SDK (v2).
// Please visit https://alexa.design/cookbook for additional examples on implementing slots, dialog management,
// session persistence, api calls, and more.
const Alexa = require('ask-sdk-core');
const data = require('./DateScores.json');
const map = require('./RequestMap.json');
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

const redoLeadIn = function() {
    const index = Math.floor(Math.random() * 5);
    
    return data["redoLeadin"][index] + "<break strength='medium'/>";
};


const neutral = function(name) {
    const dbName = data[name];
    const index = Math.floor(Math.random() * 3);
    
    return dbName["neutral"][index] + "<break time='1.5s' />";
};

const disliked = function(name) {
    const dbName = data[name];
    const index = Math.floor(Math.random() * 3);
    
    return dbName["disliked"][index] + "<break time='1.5s' />";
};

// *****************************************************************************
// SEED FUNCTIONS
// *****************************************************************************

// function to generate a random seed for questions
const qindex = [...Array(13).keys()];

// Function to randomly pick x distinct elements from an array
const shuffle = function(array) {
  var temp = array.slice();
  for (let i = temp.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [temp[i], temp[j]] = [temp[j], temp[i]];
   }
  return temp.slice(0,6);
}

const ask = function(ind) {
    return data["questions"][ind]["text"];
}

// *****************************************************************************
// SESSION ATTRIBUTES FORMAT
//      datePoints          int : current points
//      prevAnswerPoints    int : points from prev answer
//      va_name          string : name of current date partner
//      cur_ind             int : index of current asked question
//      redo_ind            int : index of previously redone question
//      seed              [int] : array of question numbers to ask user e.g. [10,4,3,9,7,0]
//
// *****************************************************************************


// *****************************************************************************
// API HANDLERS
// *****************************************************************************

const GoOnDateAPIHandler = {
    
    canHandle(handlerInput) {
        return util.isApiRequest(handlerInput, 'goOnDate');
    },
    handle(handlerInput) {
        
        const apiRequest = handlerInput.requestEnvelope.request.apiRequest;
        
        let name = resolveEntity(apiRequest.slots, "va_name");
        let location = resolveEntity(apiRequest.slots, "date_location");
        let seed = [3,4,5,6,7,8]; //shuffle(qindex);
        
        let goOnDateResult = {};
        if (name !== null && location !== null) {
            // TODO: Do some checking so you can't call goOnDate multiple times
            const dbLocation = data[name][location];
            const datePoints = dbLocation.datePoints;
            
            goOnDateResult = speak(dbLocation.response + dbLocation.start + leadIn(name) + ask(seed[0]));
            
            const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

            sessionAttributes.datePoints = datePoints;
            sessionAttributes.prevAnswerPoints = datePoints;
            sessionAttributes.va_name = name;
            sessionAttributes.cur_ind = 0;
            sessionAttributes.redo_ind = -1;
            sessionAttributes.seed = seed;
            console.log("Current date points are ", datePoints);
            
            handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
        }
        
        const response = buildSuccessApiResponse(goOnDateResult);
        console.log('GoOnDateAPIHandler', JSON.stringify(response));
        
        return response;
    }
};

const FinishDateAPIHandler = {
    
    canHandle(handlerInput) {
        return util.isApiRequest(handlerInput, 'finishDate');
    },
    handle(handlerInput) {
        
        const apiRequest = handlerInput.requestEnvelope.request.apiRequest;
        
        // TODO: check cur_ind == 6 or whatever
        
        let finishDateResult = {};
        // TODO: Do some checking so you can't call goOnDate multiple times
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const name = sessionAttributes.va_name;
        const datePoints = sessionAttributes.datePoints;
        //const seed = sessionAttributes.seed;
        //const cur_ind = sessionAttributes.cur_ind; 
        
        let outcome = "";
        if (datePoints >= 180) { // Given 6 question + date location, highest score is 30*7=210, average score is 7*(30+20+20+10+10)/5=126
            outcome = data[name]["outcome"]["perfect"];
        } else if (datePoints >= 150) {
            outcome = data[name]["outcome"]["great"];
        } else if (datePoints >= 110) {
            outcome = data[name]["outcome"]["good"];
        } else { // (datePoints < 110)
            outcome = data[name]["outcome"]["poor"];
        }
        
        finishDateResult = speak(outcome + " Would you like to try again? You can pick the same or a different partner. ");
        
        sessionAttributes.datePoints = 0;
        sessionAttributes.va_name = "";
        sessionAttributes.cur_ind = 0;
        sessionAttributes.redo_ind = -1;
        sessionAttributes.seed = null;
        console.log("Current date points are ", datePoints);
        
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
        
        const response = buildSuccessApiResponse(finishDateResult);
        console.log('FinishDateAPIHandler', JSON.stringify(response));
        
        return response;
    }
};

// Date questions handler
const questionhandle = function(handlerInput, questionName) {
    
    const apiRequest = handlerInput.requestEnvelope.request.apiRequest;
    
    let user_response = {};
    if (questionName === "numChildrenQuestion") { // can't use resolveEntity() for this one
        user_response = apiRequest.arguments[map[questionName]["slot"]];
    } else {
        user_response = resolveEntity(apiRequest.slots, map[questionName]["slot"]);
    }
    
    let questionResult = {};
    if (user_response !== null) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const name = sessionAttributes.va_name;
        const seed = sessionAttributes.seed;
        const cur_ind = sessionAttributes.cur_ind; // current question index. TODO: add constraint for when index is out of bounds => should lead to ending dialogue
        
        let currentQuestion = data["questions"][seed[cur_ind]]["name"];
        let answeredQuestion = map[questionName]["dbkey"];
        
        // Check if the correct answer was given for the correct question 
        if (currentQuestion !== answeredQuestion) {
            console.log("Mismatch for question and answer ", currentQuestion, answeredQuestion);
            questionResult = speak("I don't understand your answer. I'll ask again. " + ask(seed[cur_ind]));
            const response = buildSuccessApiResponse(questionResult);
            return response;
        }
        
        let dbQuestion = data[name][map[questionName]["dbkey"]][user_response];
        
        let datePoints = 0;
        if (dbQuestion !== undefined) { // Not faveColor or numChildren
            datePoints = dbQuestion.datePoints;
        } else if (questionName === "faveColorQuestion") { // If color is not in the database, just give 20 points
            datePoints = 20;
        } else if (questionName === "numChildrenQuestion") {  // Points for numChildren is 30 if exact, and -5 for every 1 child off, down to a minimum of 10 points
            dbQuestion = data[name][map[questionName]["dbkey"]];
            const ideal = dbQuestion.ideal;

            datePoints = Math.max(10, 30 - 5 * Math.abs(ideal-user_response));
        }
        
        let response = "";
        if (datePoints >= 25) {                 // 25 or 30 for perfect answer
            response = dbQuestion.response;
        } else if (datePoints === 20) {         // 20 for neutral answer
            response = neutral(name);
        } else {                                // 10 or 15 for disliked answer
            response = disliked(name);
        }
        
        
        questionResult = speak(response + leadIn(name) + ask(seed[cur_ind+1]));
        
        sessionAttributes.datePoints += datePoints;
        sessionAttributes.prevAnswerPoints = datePoints;
        sessionAttributes.cur_ind += 1;
        console.log("Current date points are ", datePoints);
        
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
    }
    
    const response = buildSuccessApiResponse(questionResult);
    console.log(questionName + 'Handler', JSON.stringify(response));
    
    return response;
};

const ChangeAnswerAPIHandler = { // TODO: perhaps add some sort of penalty for changing answer
    canHandle(handlerInput) {
        return util.isApiRequest(handlerInput, 'changeAnswer');
    },
    
    handle(handlerInput) {
        
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const name = sessionAttributes.va_name;
        const seed = sessionAttributes.seed;
        const cur_ind = sessionAttributes.cur_ind;
        const redo_ind = sessionAttributes.redo_ind;
        
        if (redo_ind < cur_ind-1) {
            const reprompt = speak(redoLeadIn() + ask(seed[cur_ind-1])); // TODO: use different dialog when asking to redo question
            
            sessionAttributes.datePoints -= sessionAttributes.prevAnswerPoints;
            sessionAttributes.prevAnswerPoints = 0;
            sessionAttributes.cur_ind = cur_ind-1;
            sessionAttributes.redo_ind = cur_ind-1;
            handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
            
            const response = buildSuccessApiResponse(reprompt);
            console.log('ChangeAnswerAPIHandler', JSON.stringify(response));
            
            return response;
            
        } else {
            let cur_ind = sessionAttributes.cur_ind;
            console.log("Attempt to change answer that cannot be changed ");

            const reprompt = speak("You can't change your mind again! Next question, " + ask(seed[cur_ind])); // TODO: use more elegant dialog
        
            const response = buildSuccessApiResponse(reprompt);
            return response;
        }
    }
};    

const FridayNightQuestionAPIHandler = {
    canHandle(handlerInput) { return util.isApiRequest(handlerInput, 'fridayNightQuestion'); },
    handle(handlerInput) { return questionhandle(handlerInput,       'fridayNightQuestion'); }
};
const FirstDateQuestionAPIHandler = {
    canHandle(handlerInput) { return util.isApiRequest(handlerInput, 'firstDateQuestion'); },
    handle(handlerInput) { return questionhandle(handlerInput,       'firstDateQuestion'); }
};
const SuperpowerQuestionAPIHandler = {
    canHandle(handlerInput) { return util.isApiRequest(handlerInput, 'superpowerQuestion'); },
    handle(handlerInput) { return questionhandle(handlerInput,       'superpowerQuestion'); }
};
const NumChildrenQuestionAPIHandler = {
    canHandle(handlerInput) { return util.isApiRequest(handlerInput, 'numChildrenQuestion'); },
    handle(handlerInput) { return questionhandle(handlerInput,       'numChildrenQuestion'); }
};
const FaveColorQuestionAPIHandler = {
    canHandle(handlerInput) { return util.isApiRequest(handlerInput, 'faveColorQuestion'); },
    handle(handlerInput) { return questionhandle(handlerInput,       'faveColorQuestion'); }
};
const SpiritAnimalQuestionAPIHandler = {
    canHandle(handlerInput) { return util.isApiRequest(handlerInput, 'spiritAnimalQuestion'); },
    handle(handlerInput) { return questionhandle(handlerInput,       'spiritAnimalQuestion'); }
};
const MovieGenreQuestionAPIHandler = {
    canHandle(handlerInput) { return util.isApiRequest(handlerInput, 'movieGenreQuestion'); },
    handle(handlerInput) { return questionhandle(handlerInput,       'movieGenreQuestion'); }
};
const FaveSeasonQuestionAPIHandler = {
    canHandle(handlerInput) { return util.isApiRequest(handlerInput, 'faveSeasonQuestion'); },
    handle(handlerInput) { return questionhandle(handlerInput,       'faveSeasonQuestion'); }
};
const TattooLocationQuestionAPIHandler = {
    canHandle(handlerInput) { return util.isApiRequest(handlerInput, 'tattooLocationQuestion'); },
    handle(handlerInput) { return questionhandle(handlerInput,       'tattooLocationQuestion'); }
};
const OpenBusinessQuestionAPIHandler = {
    canHandle(handlerInput) { return util.isApiRequest(handlerInput, 'openBusinessQuestion'); },
    handle(handlerInput) { return questionhandle(handlerInput,       'openBusinessQuestion'); }
};
const DucksHorsesQuestionAPIHandler = {
    canHandle(handlerInput) { return util.isApiRequest(handlerInput, 'ducksHorsesQuestion'); },
    handle(handlerInput) { return questionhandle(handlerInput,       'ducksHorsesQuestion'); }
};
const DogsCatsQuestionAPIHandler = {
    canHandle(handlerInput) { return util.isApiRequest(handlerInput, 'dogsCatsQuestion'); },
    handle(handlerInput) { return questionhandle(handlerInput,       'dogsCatsQuestion'); }
};
const CoffeeTeaQuestionAPIHandler = {
    canHandle(handlerInput) { return util.isApiRequest(handlerInput, 'coffeeTeaQuestion'); },
    handle(handlerInput) { return questionhandle(handlerInput, '      coffeeTeaQuestion'); }
};

/*
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
            const seed = sessionAttributes.seed;
            const cur_ind = sessionAttributes.cur_ind + 1; // current question index. TODO: add constraint for when index is out of bounds => should lead to ending dialogue
             
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
            
            friNightResult = speak(response + leadIn(name) + ask(seed[cur_ind]));

            sessionAttributes.datePoints += datePoints;
            sessionAttributes.cur_ind += 1;
            console.log("Current date points are ", datePoints);
            
            handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
        }
        
        const response = buildSuccessApiResponse(friNightResult);
        console.log('fridayNightQuestionHandler', JSON.stringify(response));
        
        return response;
    }
};

const FirstDateQuestionAPIHandler = {
    
    canHandle(handlerInput) {
        return util.isApiRequest(handlerInput, 'firstDateQuestion');
    },
    handle(handlerInput) {
        
        const apiRequest = handlerInput.requestEnvelope.request.apiRequest;
        let first_date = resolveEntity(apiRequest.slots, "first_date");
        
        let firstDateResult = {};
        if (first_date !== null) {
            const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
            const name = sessionAttributes.va_name;
            const seed = sessionAttributes.seed;
            const cur_ind = sessionAttributes.cur_ind + 1;
             
            const dbFirstDate = data[name]["firstDate"][first_date];
            const datePoints = dbFirstDate.datePoints;
            
            let response = "";
            if (datePoints === 30) {
                response = dbFirstDate.response;
            } else if (datePoints === 20) {
                response = neutral(name);
            } else { // (datePoints === 10)
                response = disliked(name);
            }
            
            firstDateResult = speak(response + leadIn(name) + ask(seed[cur_ind]));

            sessionAttributes.datePoints += datePoints;
            sessionAttributes.cur_ind += 1;
            console.log("Current date points are ", datePoints);
            
            handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
        }
        
        const response = buildSuccessApiResponse(firstDateResult);
        console.log('firstDateQuestionHandler', JSON.stringify(response));
        
        return response;
    }
};
*/

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
        FinishDateAPIHandler,
        ChangeAnswerAPIHandler,
        FridayNightQuestionAPIHandler,
        FirstDateQuestionAPIHandler,
        SuperpowerQuestionAPIHandler,
        NumChildrenQuestionAPIHandler,
        FaveColorQuestionAPIHandler,
        SpiritAnimalQuestionAPIHandler,
        MovieGenreQuestionAPIHandler,
        FaveSeasonQuestionAPIHandler,
        TattooLocationQuestionAPIHandler,
        OpenBusinessQuestionAPIHandler,
        DucksHorsesQuestionAPIHandler,
        DogsCatsQuestionAPIHandler,
        CoffeeTeaQuestionAPIHandler,
        CheckDateStatusAPIHandler,
        IntentReflectorHandler, // make sure IntentReflectorHandler is last so it doesn't override your custom intent handlers
    )
    .addErrorHandlers(
        ErrorHandler,
    )
    .addRequestInterceptors(LogRequestInterceptor)
    .addResponseInterceptors(LogResponseInterceptor)
    .lambda();
