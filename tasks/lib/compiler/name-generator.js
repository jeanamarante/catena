var maxTolerance = 3;
var sequenceList = [];
var sequenceNames = {};
var sequenceIndex = 0;

// Maximum amount of characters in a sequence are (52 - 1)
var sequenceMaxIndex = 51;

/**
 * @function addNewSequence
 * @api private
 */

function addNewSequence () {
    // Sequences are arrays composed of all lower and upper
    // case characters in the alphabet.
    var sequence = 'abcdefghijklmnopqrstuvwxyz';

    sequence += sequence.toUpperCase();
    sequence = sequence.split('');

    sequenceList.push(sequence);

    // Start searching sequences at zero when a new one gets added.
    sequenceIndex = 0;

    // Anytime a new sequence is added shuffle all of them.
    shuffleSequences();
}

/**
 * Traverse all sequences and shuffle them.
 *
 * @function shuffleSequences
 * @api private
 */

function shuffleSequences () {
    for (var i = 0, max = sequenceList.length; i < max; i++) {
        shuffle(sequenceList[i]);
    }
}

/**
 * Fisher-Yates shuffle.
 *
 * @function shuffle
 * @api private
 */

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

/**
 * Create a string from the characters inside sequences.
 *
 * @function concatenateCharacters
 * @return {String}
 * @api private
 */

function concatenateCharacters () {
    var chars = '';

    for (var i = 0, max = sequenceList.length; i < max; i++) {
        var arr = sequenceList[i];

        // While traversing the sequences append the character
        // in the sequenceIndex.
        chars += arr[sequenceIndex];
    }

    if (sequenceIndex < sequenceMaxIndex) {
        sequenceIndex++;
    } else {
        sequenceIndex = 0;

        // Shuffle all sequences once all of them have been traversed.
        shuffleSequences();
    }

    return chars;
}

/**
 * Generate unique name from sequences.
 *
 * @function generateName
 * @return {String}
 * @api private
 */

module.exports.generateName = function () {
    var name = '';
    var isUnique = false;
    var tolerance = 0;

    // If sequenceList is empty add new sequence.
    if (sequenceList.length === 0) {
        addNewSequence();
    }

    // Keep concatenating characters until a unique name is created.
    while (!isUnique) {
        // If after several attempts the generated names keep
        // being repetitive. Add new sequence.
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
