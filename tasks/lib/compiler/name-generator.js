var maxTolerance = 3;
var sequenceList = [];
var sequenceNames = {};
var sequenceIndex = 0;
var sequenceMaxIndex = 51;

function addNewSequence () {
    var sequence = 'abcdefghijklmnopqrstuvwxyz';

    sequence += sequence.toUpperCase();
    sequence = sequence.split('');

    sequenceList.push(sequence);

    sequenceIndex = 0;

    shuffleSequences();
}

function shuffleSequences () {
    for (var i = 0, max = sequenceList.length; i < max; i++) {
        shuffle(sequenceList[i]);
    }
}

function shuffle (arr) {
    for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.round(Math.random() * i);

        // Temporary value.
        var temp = arr[i];

        // Swap values.
        arr[i] = arr[j];
        arr[j] = temp;
    }
}

function concatenateCharacters () {
    var chars = '';

    for (var i = 0, max = sequenceList.length; i < max; i++) {
        var arr = sequenceList[i];

        chars += arr[sequenceIndex];
    }

    if (sequenceIndex < sequenceMaxIndex) {
        sequenceIndex++;
    } else {
        sequenceIndex = 0;

        shuffleSequences();
    }

    return chars;
}

addNewSequence();

module.exports.generateName = function () {
    var name = '';
    var isUnique = false;
    var tolerance = 0;

    while (!isUnique) {
        if (tolerance < maxTolerance) {
            tolerance++;
        } else {
            tolerance = 0;

            addNewSequence();
        }

        name = concatenateCharacters();

        isUnique = !sequenceNames[name];
    }

    sequenceNames[name] = true;

    return name;
};
