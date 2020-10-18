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

const speakAs = function(name, speech, isFemale) {
    if (name === "alexa") {
        return speak(speech);
    }
    
    var voice = "";
    if (name === "lexi") {
        voice = isFemale ? "Emma" : "Brian";
    } else if (name === "siri") {
        voice = isFemale ? "Joanna" : "Joey";
    } else if (name === "google") {
        voice = isFemale ? "Nicole" : "Russell";
    } else if (name === "cortana") {
        voice = isFemale ? "Salli" : "Matthew";
    } else if (name === "bixby") {
        voice = isFemale ? "Amy" : "Geraint";
    }
    
    var charSpeech = "";
    if (voice === "") {
        charSpeech = `${speech}`;
    } else {
        charSpeech = `<voice name='${voice}'>${speech}</voice>`;
    }
    return speak(charSpeech);
};

const constructAplaAs = function(name, speech, isFemale) {
    let apla = {
        "type": "Speech",
        "contentType": "SSML",
        "content": speakAs(name, speech, isFemale)
    };
    return apla;
};

const constructAudio = function(audio) {
    let apla = {
        "type": "Audio",
        "source": audio
    };
    return apla;
};

const constructAplaWithAudioAs = function(name, speech,audio, isFemale) {
    let apla = {
        "type": "Mixer",
        "items": [
            {
                "type": "Speech",
                "contentType": "SSML",
                "content": speakAs(name, speech, isFemale)
            },
            {
                "type": "Audio",
                "source": audio
            }
        ]
    }
    return apla;
};

const constructAplaArrayAs = function(name,dbEntry, isFemale) {
    if (Array.isArray(dbEntry)) {
        let aplaArray = [];
        for (let i = 0; i < dbEntry.length; i++) {
            let subEntry = dbEntry[i];
            if (subEntry.type === "Speech") {
                aplaArray.push(constructAplaAs(name, subEntry.content, isFemale));
            } else { // subEntry.type === "Audio"
                aplaArray.push(constructAudio(subEntry.content));
            }
        }
        return aplaArray;
    } else { // Assume its an ssml string
        return [constructAplaAs(name, dbEntry, isFemale)];
    }
}

const breakString = function(time = null) {
    if (time === null) {
        return "<break />";
    } else {
        return `<break time='${time}s' />`;
    }
}

const leadIn = function(name) {
    const dbName = data[name];
    const index = Math.floor(Math.random() * 5);
    
    return dbName["leadin"][index] + `${breakString()}`;
};

const redoLeadIn = function() {
    const index = Math.floor(Math.random() * 5);
    
    return data["redoLeadin"][index] + `${breakString()}`;
};


const neutral = function(name) {
    const dbName = data[name];
    const index = Math.floor(Math.random() * 3);
    
    return dbName["neutral"][index] + `${breakString(1.5)}`;
};

const disliked = function(name) {
    const dbName = data[name];
    const index = Math.floor(Math.random() * 3);
    
    return dbName["disliked"][index] + `${breakString(1.5)}`;
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
//      isFemale           bool : boolean representing gender of date
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
        let gender = resolveEntity(apiRequest.slots, "date_gender");
        let seed = shuffle(qindex);
        
        let goOnDateResult = {};
        if (name !== null && location !== null && gender !== null) {
            // TODO: Do some checking so you can't call goOnDate multiple times
            const dbLocation = data[name][location];
            const locationAudio = data["audio"][location];
            const datePoints = dbLocation.datePoints;
            
            let isFemale = (gender === "female");
            
            let apla_response = constructAplaArrayAs(name, dbLocation.response, isFemale);
            apla_response.push(constructAplaWithAudioAs(name, `${breakString(1.5)}` + dbLocation.start, locationAudio, isFemale));
            apla_response.push(constructAplaAs(name, `${breakString(1.5)}` + leadIn(name) + ask(seed[0]), isFemale));
            
            goOnDateResult.apla = apla_response;
            
            let visual = {};
            visual.text = data["questions"][seed[0]]["shortText"];
            
            const mf = isFemale ? "Female" : "Male";
            visual.image_url = util.getS3PreSignedUrl(`Media/${mf}/${name}_hi.png`);
            visual.bg_url = util.getS3PreSignedUrl(`Media/${location}.png`);
            visual.textbox_color = data["visual"][name]["textbox_color"];
            visual.textbox_border_color = data["visual"][name]["textbox_border_color"];
            
            goOnDateResult.visual = visual;
            
            const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

            sessionAttributes.datePoints = datePoints;
            sessionAttributes.prevAnswerPoints = datePoints;
            sessionAttributes.va_name = name;
            sessionAttributes.date_location = location;
            sessionAttributes.cur_ind = 0;
            sessionAttributes.redo_ind = -1;
            sessionAttributes.seed = seed;
            
            sessionAttributes.visual = visual;
            sessionAttributes.isFemale = isFemale;
            
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
        
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const name = sessionAttributes.va_name;
        const location = sessionAttributes.date_location;
        const cur_ind = sessionAttributes.cur_ind; 
        const isFemale = sessionAttributes.isFemale;
        
        if (cur_ind < 6) {
            const apla_response = constructAplaAs(name, "Please stay, there's still more questions I have for you.", isFemale);
            let unfinishedDateResult = {};
            unfinishedDateResult.apla = apla_response;
            unfinishedDateResult.visual = sessionAttributes.visual;
            // sessionAttributes.cur_ind = cur_ind-1;
            // sessionAttributes.redo_ind = cur_ind-1;
            handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
            const response = buildSuccessApiResponse(unfinishedDateResult);
            console.log('Unfinished FinishDateAPIHandler Call', JSON.stringify(response));
            return response;
        }
        
        // TODO: Do some checking so you can't call goOnDate multiple times
        const datePoints = sessionAttributes.datePoints;
        //const seed = sessionAttributes.seed;
        //const cur_ind = sessionAttributes.cur_ind; 
        
        let outcome = "";
        let outcomeText = "";
        if (datePoints >= 170) { // Given 6 question + date location, highest score is 30*7=210, average score is 7*(30+20+20+10+10)/5=126
            outcome = data[name]["outcome"]["perfect"];
            outcomeText = "Amazing!";
        } else if (datePoints >= 135) {
            outcome = data[name]["outcome"]["great"];
            outcomeText = "Awesome!";
        } else if (datePoints >= 100) {
            outcome = data[name]["outcome"]["good"];
            outcomeText = "Not bad";
        } else { // (datePoints < 100)
            outcome = data[name]["outcome"]["poor"];
            outcomeText = "It was okay";
        }
        
        const date_end = data[name][location]["end"];
        const locationAudio = data["audio"][location];
        
        const apla_response = [
            constructAplaWithAudioAs(   name, `${breakString(1.5)}` + date_end, locationAudio, isFemale),
            constructAplaAs(            name, outcome, isFemale),
            constructAplaAs(            "alexa", " Would you like to try again? You can pick the same or a different partner. ", true)
        ];
        let finishDateResult = {};
        finishDateResult.apla = apla_response;
        finishDateResult.visual = sessionAttributes.visual;
        finishDateResult.visual.text = outcomeText;
        
        const mf = isFemale ? "Female" : "Male";
        finishDateResult.visual.image_url = util.getS3PreSignedUrl(`Media/${mf}/${name}_bye.png`);
        
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
    if (questionName === "numChildrenQuestion" || questionName === "faveColorQuestion") { // can't use resolveEntity() for this one
        user_response = apiRequest.arguments[map[questionName]["slot"]];
    } else {
        user_response = resolveEntity(apiRequest.slots, map[questionName]["slot"]);
    }
    console.log("==== USER RESPONSE ====", user_response);
    let questionResult = {};
    
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    const name = sessionAttributes.va_name;
    const seed = sessionAttributes.seed;
    const cur_ind = sessionAttributes.cur_ind; // current question index. TODO: add constraint for when index is out of bounds => should lead to ending dialogue
    const isFemale = sessionAttributes.isFemale;

    let currentQuestion = data["questions"][seed[cur_ind]]["name"];
    let answeredQuestion = map[questionName]["dbkey"];
    
    questionResult.visual = sessionAttributes.visual;
    
    // Check if the correct answer was given for the correct question 
    if (user_response === null || currentQuestion !== answeredQuestion) {
        console.log("Mismatch for question and answer ", currentQuestion, answeredQuestion);
        const apla_response = constructAplaAs(name, "I don't understand your answer. I'll ask again. " + ask(seed[cur_ind]), isFemale);
        questionResult.apla = apla_response;
        questionResult.visual = sessionAttributes.visual;
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

        datePoints = Math.max(10, 30 - 6 * Math.abs(ideal-user_response));
    }
    
    let responseText = "";
    let emotion = "";
    if (datePoints >= 25) {                 // 25 or 30 for perfect answer
        responseText = dbQuestion.response;
        if (responseText === undefined) { responseText = ''; }
        emotion = "happy";
    } else if (datePoints === 20) {         // 20 for neutral answer
        responseText = neutral(name);
        emotion = "neutral";
    } else {                                // 10 or 15 for disliked answer
        responseText = disliked(name);
        emotion = "sad";
    }
    
    let apla_response = constructAplaArrayAs(name, responseText, isFemale);
    if (cur_ind >= 5) {
        let audio = "soundbank://soundlibrary/foley/amzn_sfx_clock_ticking_01";
        apla_response.push(
            constructAplaWithAudioAs(name, `${breakString(1)}` + "It's getting late, shall we get going? Please say " + `${breakString(0.5)}` + " let's end the date. ", audio, isFemale)
        );
        questionResult.visual.text = "It's getting late...";
    } else {
        apla_response.push(constructAplaAs(name, leadIn(name) + ask(seed[cur_ind+1]), isFemale));
        questionResult.visual.text = data["questions"][seed[cur_ind+1]]["shortText"];
    }
    
    questionResult.apla = apla_response;
    
    const mf = isFemale ? "Female" : "Male";
    questionResult.visual.image_url = util.getS3PreSignedUrl(`Media/${mf}/${name}_${emotion}.png`);
    
    sessionAttributes.datePoints += datePoints;
    sessionAttributes.prevAnswerPoints = datePoints;
    sessionAttributes.cur_ind += 1;
    console.log("Current date points are ", datePoints);
    
    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
    
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
        const isFemale = sessionAttributes.isFemale;
        
        const repromptResult = {};
        repromptResult.visual = sessionAttributes.visual;
        if (redo_ind < cur_ind-1) {
            repromptResult.apla = constructAplaAs(name, redoLeadIn() + ask(seed[cur_ind-1]), isFemale);
            repromptResult.visual.text = data["questions"][seed[cur_ind-1]]["shortText"];
            
            sessionAttributes.datePoints -= sessionAttributes.prevAnswerPoints;
            sessionAttributes.prevAnswerPoints = 0;
            sessionAttributes.cur_ind = cur_ind-1;
            sessionAttributes.redo_ind = cur_ind-1;
            handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
            
            const response = buildSuccessApiResponse(repromptResult);
            console.log('ChangeAnswerAPIHandler', JSON.stringify(response));
            
            return response;
            
        } else if (cur_ind === 0) {
            console.log("Attempt to change before answering. ");

            repromptResult.apla = constructAplaAs(name, "You haven't answered anything yet! Let me know, " + ask(seed[cur_ind]), isFemale);
        
            const response = buildSuccessApiResponse(repromptResult);
            return response;
        } else {
            let cur_ind = sessionAttributes.cur_ind;
            console.log("Attempt to change answer that cannot be changed. ");

            repromptResult.apla = constructAplaAs(name, "You can't change your answer again! Next question, " + ask(seed[cur_ind]), isFemale);
        
            const response = buildSuccessApiResponse(repromptResult);
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
    handle(handlerInput) { return questionhandle(handlerInput,       'coffeeTeaQuestion'); }
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
        const speakOutput = `Sorry, not sure what you mean. Please answer the previous prompt. You can say, can you please repeat? to hear the prompt again.`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

// *****************************************************************************
// Resolves catalog value using Entity Resolution
const resolveEntity = function(resolvedEntity, slotName) {
    let value = null;
    //This is built in functionality with SDK Using Alexa's ER
    if (resolvedEntity[slotName] !== null) {
        
        let erAuthorityResolution = resolvedEntity[slotName].resolutions 
            .resolutionsPerAuthority[0];
        
        
        if (erAuthorityResolution.status.code === 'ER_SUCCESS_MATCH') {
            value = erAuthorityResolution.values[0].value.name;
        }
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
