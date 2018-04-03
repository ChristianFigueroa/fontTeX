!function() {
    "use strict";
    // The TeXbook has an extended metaphor throughout the book that compares TeX's
    // parsing to an organism that eats the input string and converts it into tokens,
    // and then digests those tokens to make "atoms," which are used to typeset the
    // TeX. The code in this script follows that metaphor with the naming of classes
    // and functions. The `Mouth' class for example is where the input string is con-
    // verted to tokens using an `eat' function. Those tokens are later "digested" to
    // produce atoms.


    // Since the whole script is enclosed in a function, none of the variables defined
    // in here will reach the global scope. The developer using the script still needs
    // a way to interface with the functions in this script though, so everything the
    // developer may need is stored in a global object defined below.
    window.fontTeX = window.fontTeX || {}


    // If, for whatever reason, someone loaded two version of fontTeX, the one with the
    // latest version number ones. They're compared as string instead of numbers to
    // handle version numbers with double digits like 1.10.15.
    var current = '0.1';
    if (fontTeX.version) {
        if (current.split('.').map(function(number) {
            return String.fromCharCode(48 + +number);
        }).join('') < fontTeX.version.split('.').map(function(number) {
            return String.fromCharCode(48 + +number);
        }).join('')) {
            return;
        };
    }
    fontTeX.version = current;


    // Since `console.log' is actually used in some of the TeX commands here, I figured
    // I should make a dedicated function to differentiate between sending a message on
    // purpose and sending a debugging message.
    function _msg() {
        console.log.apply(console, arguments);
    }

    // The `render' function defined below is what the developer can call to parse a
    // string of TeX. This just converts it into a token list; nothing is being dis-
    // played yet. To display the tokens, the developer calls the returned object
    // from this function's `in' function (e.g. fontTeX.render('TeX').in('#id')).
    fontTeX.render = function render(TeXstring) {
        // This function is used to tell the script what to parse. The only argument should
        // be a string (it's converted into one if it't not). That string will first be
        // passed to the TeX processor, where anything between certain delimiters will be
        // parsed as TeX. Delimiters include $$ ... $$ and \[ ... \] for displayed equa-
        // tions and $ ... $ and \( ... \) for inline equations. Any HTML inside the delim-
        // iters will be parsed as TeX and won't contribute to the HTML outside the delimi-
        // iters (i.e. you can't start HTML outside the TeX and close it inside or vice
        // versa). After that, the parts of the string that weren't parsed as TeX inside
        // the delimiters will be parsed as HTML and a document fragment will be made. The
        // object returned from this function will be a ParsedFontTeX object. Calling its
        // `in' or `renderIn' method will let you display the document fragment inside any
        // (non-self-closing) element.

        var content = [],
            origString = TeXstring;
        while (TeXstring) {
            if (TeXstring[0] == '$' && TeXstring[1] == '$' || TeXstring[0] == '\\' && TeXstring[1] == '[') {
                // This indicates the start of a displayed math equation. The rest of the string is
                // passed over to the `fontTeX._tokenize' function, where all the processing takes
                // place. Once a closing delimiter is found ($$, \], or a command that expands to
                // \]), the token list is returned along with any part of the string that wasn't
                // parsed.
                var tokens = fontTeX._tokenize(TeXstring.substring(2), 'display');
                // The return value from `_tokenize' is a two-long array. The first item is an ar-
                // ray of tokens. The second is the string that was left over after parsing.
                if (!tokens[2]) {
                    content.push(TeXstring);
                    TeXstring = '';
                    break;
                }
                TeXstring = tokens[1];
                content.push([tokens[0], 'display']);
            } else if (TeXstring[0] == '$' || TeXstring[0] == '\\' && TeXstring[1] == '(') {
                // This indicates the start of an inline math equation. It is parsed the same way
                // as a displayed equation, except the closing delimiter must be a $ or \).
                var tokens = fontTeX._tokenize(TeXstring.substring(1), 'inline');
                if (!tokens[2]) {
                    content.push(TeXstring);
                    TeXstring = '';
                    break;
                }
                TeXstring = tokens[1];
                content.push([tokens[0], 'text']);
            } else {
                if (typeof content[content.length - 1] == 'string') content[content.length - 1] += TeXstring[0];
                else content.push(TeXstring[0]);
                TeXstring = TeXstring.substring(1);
            }
        }

        return new fontTeX.ParsedFontTeX(origString, content);
    };

    // This class is used by `fontTeX.render'. It includes methods that let the devel-
    // oper display parsed TeX inside elements.
    fontTeX.ParsedFontTeX = function ParsedFontTeX(string, tokens) {
        this.TeXstring = string;
        this.parsedTokens = tokens;
    };

    fontTeX.ParsedFontTeX.prototype = {
        in: function _in(elementsOrString) {
            // This method renders the document fragment associated with this object inside
            // a set of elements. The argument can be either a string, an array, a NodeList,
            // or an HTMLCollection. If it's a string, it will be used as a CSS identifier to
            // return a list of elements that match that CSS query. If it's an array, NodeList,
            // or HTMLCollection, it will be iterated over. Any string (inside an array) will
            // be used the same way as if it had been passed as the single argument. Any elem-
            // ent inside the array/NodeList/HTMLCollection will be used to render the document
            // fragment in. There is a `renderIn' alias function that can be used instead.

            // If the argument isn't an iterable object (string or single element), call this
            // method again so that the argument will definitely be iterable.
            var arg = elementsOrString,
                tokens = this.parsedTokens;
            if (typeof arg == 'string') {
                return this.in(document.querySelectorAll(arg));
            } else if (arg instanceof HTMLElement) {
                return this.in([arg]);
            } else if (!isNaN(arg.length)) {
                for (var i = 0, l = arg.length; i < l; i++) {
                    // This is where all the rendering happens.
                    var family = getComputedStyle(arg[i]).fontFamily,
                        frag = document.createDocumentFragment();
                    for (var n = 0, j = tokens.length; n < j; n++) {
                        if (typeof tokens[n] == 'string') {
                            frag.appendChild(document.createTextNode(tokens[n]));
                        } else {
                            frag.appendChild(fontTeX._genHTML(arg[i], tokens[n][0], tokens[n][1], family));
                        }
                    }
                    arg[i].innerHTML = '';
                    arg[i].appendChild(frag);
                }
            }
        },
        renderIn: function renderIn(elementsOrString) {
            // This method renders the document fragment associated with this object inside
            // a set of elements. The argument can be either a string, an array, a NodeList,
            // or an HTMLCollection. If it's a string, it will be used as a CSS identifier to
            // return a list of elements that match that CSS query. If it's an array, NodeList,
            // or HTMLCollection, it will be iterated over. Any string (inside an array) will
            // be used the same way as if it had been passed as the single argument. Any elem-
            // ent inside the array/NodeList/HTMLCollection will be used to render the document
            // fragment in. There is a `in' alias function that can be used instead.
            this.in.apply(this, arguments);
        },
        again: function again() {
            // This method will take the original string of TeX and reparse it. This can be
            // helpful for new definitions that weren't there the first time the string was
            // parsed, or for certain registers, like \time, which changes every minute.
            // There is a `rerender' alias function that can be used instead.
        },
        rerender: function() {
            // This method will take the original string of TeX and reparse it. This can be
            // helpful for new definitions that weren't there the first time the string was
            // parsed, or for certain registers, like \time, which changes every minute.
            // There is an `again' alias function that can be used instead.
            this.again.apply(this, arguments);
        }
    }


    // The `render' function defined above is just an interface that makes use of the
    // `_tokenize' function defined below. It converts a string of TeX into an array
    // of tokens. Most of them are atoms which translate into individual characters
    // or groups of characters. There are other types of tokens too though that behave
    // differently when converted to HTML.
    fontTeX._tokenize = function tokenize(TeXstring, style) {
        // This function creates a list of atoms (and other tokens, but mostly atoms) from
        // a given string. This function doesn't have to be used for the normal usage of
        // fontTeX, but it's here in case you want to parse TeX and do something different
        // with the resulting tokens. The `TeXstring' argument is the string to parse and
        // create tokens from. The `style' argument should be a string, either "display" or
        // "inline", that represents whether the equation will be displayed as a block-
        // style equation on its own line, or as an inline-style element that flows with
        // any previous text. Note that the `style' dictates what's allowed as a closing
        // delimiter. If `style == "inline"', then the string must have a "$" to stop at.
        // If `style == "display"', then the string must have a "$$" to stop parsing at.
        // The return value for this function will be a three-long array. The first item
        // will be an array of tokens that were parsed form the string. The second will be
        // a string indicating what portion of the string was left after finding the clos-
        // ing delimiter mentioned above. The third item will be a boolean indicating
        // whether the closing delimiter was found in the first place. If the string pro-
        // vided doesn't have a closing delimiter to exit math mode, then the third item
        // will be false, the first item will be an empty array (since no tokens were got-
        // ten because it never found where to stop), and the second item will be the orig-
        // inal string provided (`TeXstring') since no tokens were taken from the string.
        // If this happens, even though no tokens were actually returned, all the TeX that
        // was parsed to reach the end of the string will still actually have an effect.
        // For example, say the string "\global\catcode`\!=3$" was passed with `style' be-
        // ing set equal to "display". The "\global\catcode`\!=3" portion of the string is
        // all executed, and the catcode for "!" is changed on the global scope. Now the
        // "$" is found, but there needs to be "$$" to exit math mode on "display" style.
        // Since "$$" was never found, all the tokens that have already been parsed will
        // go back to the string and the array [[], "\global\catcode`\!=3$", false] will
        // be returned. Notice that the original string and no tokens were returned, be-
        // cause there was never a closing delimiter. Even though the "\catcode" command
        // was executed, since the text never fully closed, the tokens were reverted, but
        // the "\catcode" command's effect wasn't.

        if (style !== 'display' && style !== 'inline') {
            throw new TypeError('No "display" or "inline" style specified for fontTeX._tokenize.');
        }

        // The `queue' array is used to store tokens. Basically, if there are tokens in
        // this array, they are used by the Mouth class instead of being taking from the
        // string. This is helpful for command replacement since the tokens have already
        // been parsed by the time the command is used. Even though it's called a `queue',
        // it's more of a stack since tokens are manipulated in a first-in-last-out manner.
        // Tokens are added on to and taken from the beginning.
        var queue = [];

        // "TeXstring" is a long name. It's only named that to make it clear what the argu-
        // ment should be. `string' is simply assigned to prevent having to type a longer
        // name than necessary.
        var string = TeXstring;

        // The `scopes' array keeps track of open scopes. A new scope is created whenever
        // there's a new group. For example, "sc{ope}" has an outer scope around the whole
        // string, and then there's another scope pertaining only to the "ope" part. Any
        // definitions made inside a scope are local only to that scope. The only way it
        // can affect outer scopes is if \global precedes the definition.
        var scopes = [];
        // Assign a `last' attribute to the array so that the last item is easily acces-
        // sible.
        Object.defineProperty(scopes, 'last', {
            get: function() {
                return this[this.length - 1];
            }
        });
        // Add a new Scope to the array.
        new Scope();

        // This is where the list of tokens will go.
        var finalTokens = [];

        // In certain situations, a command affects the token immediately after it. For ex-
        // ample, if a \def is prefixed with \global, the \global command affects the \def.
        // The logic for \def should still run normally, but the \global affects which
        // scopes are affected by the \def. That's why this object is here. It keeps track
        // of "toggled" states like \global. \long and \outer aren't included in this ver-
        // sion of TeX because they don't REALLy add any functionality other than error
        // debugging.
        var prefixedToggles = {
            global: false,
            mathchoice: false
        }

        // `contexts' keeps track of the context of what's being parsed. For example, when
        // a superscript token is found, a new context is opened called "superscript". It
        // tells the next atom to be parsed that it should be added on to the previous atom
        // as a superscript instead of becoming its own distinct atom. It's an array be-
        // cause multiple contexts can be opened at once.
        var contexts = [];
        // Assign a `last' attribute to the array so that the last item is easily acces-
        // sible.
        Object.defineProperty(contexts, 'last', {
            get: function() {
                return this[this.length - 1];
            }
        });


        // Now that some variables have been established, some functions and classes
        // also need to be defined.
        function Mouth(customString, customQueue) {
            // The Mouth class is used to retrieve tokens. It can be either taken from `queue'
            // or from `string'. When a token is taken using the `eat' method, the Mouth's own
            // copies of `string' and `queue' are affected without affecting the global vers-
            // ions. Only after the `finalize' method is called do the global `string' and
            // `queue' variables actually change. That lets other functions retrieve the next
            // token and decide for itself whether it actually wants that token. If it does,
            // the changes can be finalized and saved. Otherwise, the variables won't be
            // changed at all and the tokens can be reparsed at a later time. There's also
            // a `revert' method on each Mouth object that will restore the last eaten token.

            // Save a custom copy of `queue' and `string'.
            this.queue = (customQueue || queue).slice();
            this.string = typeof customString == 'string' ? customString : string;

            // The history array stores "states" of Mouth that can be restored if the `revert'
            // function is called.
            this.history = [];

            // The savedStates object is used by the saveState method defined below.
            this.savedStates = {};

            // The `eat' function, as talked about above, will "eat" part of the string or
            // queue and return a token. An optional `context' argument can be provided. This
            // will tell the function to look for a specific set of tokens. For example, if the
            // string "number" is passed, the eat function will look for a specific set of
            // tokens that make up a number. This is helpful for stuff like the \char command,
            // which expects a number to immediately follow it. If there are no more tokens to
            // parse (the string is empty) or the expected context doesn't match the tokens
            // that were parsed.
            this.eat = function eat(context) {
                switch (context) {
                    // If there is no context, just parse a single command or character token. This is
                    // what usually happens. The 'pre space' context is the same as the regular behavi-
                    // or except that space tokens can be returned (normally, whitespace tokens are
                    // skipped over and the next token is returned).
                    case undefined:
                    case 'pre space':
                    default:
                        // If there is a token in `queue', that should be returned first.
                        if (this.queue.length) {
                            if (this.queue[0].cat == data.cats.whitespace && context != 'pre space') {
                                this.queue.shift();
                                return this.eat(context);
                            }
                            this.history.push({
                                queue: this.queue.slice(),
                                string: this.string,
                                history: this.history.slice()
                            });
                            return this.queue.shift();
                        }

                        if (this.string.length == 0) {
                            // `null' is returned if there are no more tokens to parse. No history entry is
                            // created because nothing has been changed.
                            return null;
                        } else if (catOf(this.string[0]) == data.cats.escape) {
                            // An escape character was found. It indicates the start of a command.

                            // If there are no more characters, or just an eol character, then the command name
                            // is empty.
                            if (!this.string[1] || this.string[1] == '\n') {
                                this.history.push({
                                    queue: this.queue.slice(),
                                    string: this.string,
                                    history: this.history.slice()
                                });
                                this.string = this.string.substring(2);
                                return {
                                    type: 'command',
                                    escapeChar: this.string[0],
                                    name: '',
                                    nameType: 'command'
                                };
                            }

                            // Otherwise, the command actually has a name.

                            // If the first characters are a double superscript character replacement, then re-
                            // place it with the proper character.
                            if (this.string[1] == this.string[2] && catOf(this.string[1]) == data.cats.super && string[4] && '0123456789abcdef'.includes(string[3]) && '0123456789abcdef'.includes(string[4])) {
                                this.string = this.string[0] + String.fromCharCode(this.string[3] + this.string[4], 16) + this.string.substring(5);
                            } else if (this.string[1] == this.string[2] && catOf(this.string[1]) == data.cats.super && string[3].charCodeAt(0) < 128) {
                                this.string = this.string[0] + String.fromCharCode((this.string[3].charCodeAt(0) + 64) % 128) + this.string.substring(4);
                            }

                            // Check for what type of command name: either one non-letter character, or a
                            // string of only-letter characters.
                            if (catOf(this.string[1]) == data.cats.letter) {
                                var name = '';
                                // Iterate through all the letters
                                for (var i = 1; true; i++) {
                                    // The character is a plain letter
                                    if (catOf(this.string[i]) == data.cats.letter) name += this.string[i];
                                    else if (this.string[i] == this.string[i + 1] && catOf(this.string[i]) == data.cats.super && '0123456789abcdef'.includes(this.string[i + 2]) && '0123456789abcdef'.includes(this.string[i + 3])) {
                                        // The character is a double superscript. Replace it and continue.
                                        this.string = this.string.substring(0, i) + String.fromCharCode(this.string.substring(i + 2, i + 4), 16) + this.string.substring(0, i + 4);
                                        i--;
                                    } else if (this.string[i] == this.string[i + 1] && catOf(this.string[i]) == data.cats.super && this.string.charCodeAt(i + 2) < 128) {
                                        // The character is a double superscript. Replace it and continue.
                                        this.string = this.string.substring(0, i) + String.fromCharCode((this.string.charCodeAt(i + 2) + 64) % 128) + this.string.substring(i + 3);
                                        i--;
                                    } else {
                                        // The character is a non-letter. The end of the command has been reached.
                                        break;
                                    }
                                }
                                this.history.push({
                                    queue: this.queue.slice(),
                                    string: this.string,
                                    history: this.history.slice()
                                });
                                var token = {
                                    type: 'command',
                                    escapeChar: this.string[0],
                                    name: name,
                                    nameType: 'command'
                                }
                                this.string = this.string.substring(1 + name.length);
                                return token;
                            } else {
                                this.history.push({
                                    queue: this.queue.slice(),
                                    string: this.string,
                                    history: this.history.slice()
                                });
                                var token = {
                                    type: 'command',
                                    escapeChar: this.string[0],
                                    name: this.string[1],
                                    nameType: 'symbol'
                                };
                                this.string = this.string.substring(2);
                                return token;
                            }
                        } else if (catOf(this.string[0]) == data.cats.super && this.string[0] == this.string[1] && catOf(this.string[0]) == data.cats.super && '0123456789abcdef'.includes(this.string[2]) && '0123456789abcdef'.includes(this.string[3])) {
                            // This `if' block take care of strings with double superscripts and two hexadec-
                            // imal digits (e.g. "^^41" => 0x65 => "A"). The string is then reparsed as if the
                            // character had been there all along.
                            this.string = String.fromCharCode(parseInt(this.string.substring(2, 4), 16)) + this.string.substring(4);
                            return this.eat(context);
                        } else if (catOf(this.string[0]) == data.cats.super && this.string[0] == this.string[1] && catOf(this.string[0]) == data.cats.super && this.string.charCodeAt(2) < 128) {
                            // This `if' block take care of strings with double superscripts and a single char-
                            // acter whose character code is less than 128. If the character code is less than
                            // 64, 64 is added to it. Otherwise, 64 is subtracted from it. The new number is
                            // converted to a character whose character code that corresponds to that number
                            // (e.g. "^^?" => 63 => 127 => <DELETE character, U+007F>).
                            this.string = String.fromCharCode((this.string.charCodeAt(2) + 64) % 128) + this.string.substring(3);
                            return this.eat(context);
                        } else if ([1, 2, 3, 4, 6, 7, 8, 11, 12, 13].includes(catOf(this.string[0]))) {
                            // This `if' block takes care of most characters. If it's not whitespace, a double
                            // superscript, a comment, or an invalid character, it's handled by this block. It
                            // returns a regular character token with a set catcode. Some characters in the
                            // wrong context will throw an error later (e.g. a "#" not in a \def context).
                            this.history.push({
                                queue: this.queue.slice(),
                                string: this.string,
                                history: this.history.slice()
                            });
                            var char = this.string[0];
                            this.string = this.string.substring(1);
                            return {
                                type: 'character',
                                char: char,
                                code: char.charCodeAt(0),
                                cat: catOf(char)
                            }
                        } else if (catOf(this.string[0]) == data.cats.eol) {
                            // If an end of line character is found, all the text after it on that line is dis-
                            // carded. For example, if the catcode of "A" is 5 (end of line character), and the
                            // string "A line of text \n another line of text" is encountered, the parsing will
                            // start at " another line of text". All the text after "A" up to the new line
                            // character is thrown away.
                            var index = this.string.indexOf('\n');
                            this.string = this.string.substring(~index ? index + 1 : this.string.length);
                            // After a new line, all the whitespace after it has to be removed, even in a "pre
                            // space" context.
                            while (catOf(this.string[0]) == data.cats.whitespace) this.string = this.string.substring(1);
                            // If an eol character was found, a whitespace character is added. That means an
                            // eol character is essentially a whitespace character, which are normally skipped
                            // over anyway, just not in the "pre space" context.
                            if (context == 'pre space') {
                                this.queue.unshift({
                                    type: 'character',
                                    char: ' ',
                                    code: 32,
                                    cat: data.cats.whitespace
                                });
                            }
                            return this.eat(context);
                        } else if (catOf(this.string[0]) == data.cats.comment) {
                            // Comments work the same as new line characters. All tokens on the same line are
                            // discarded, but a space token isn't added to the queue.
                            var index = this.string.indexOf('\n');
                            this.string = this.string.substring(~index ? index + 1 : this.string.length);
                            return this.eat(context);
                        } else if (catOf(this.string[0]) == data.cats.whitespace && context != 'pre space' || catOf(this.string[0]) == data.cats.ignored) {
                            // Since whitespace is completely ignored in math mode, all whitespace characters
                            // are essentially ignored. Character with catcode 9 (ignored character) are also
                            // completely skipped over. The character is removed and the rest of the string is
                            // reparsed.
                            this.string = this.string.substring(1);
                            return this.eat();
                        } else if (catOf(this.string[0]) == data.cats.whitespace && context == 'pre space') {
                            // Is there is a 'pre space' context, a whitespace token is returned instead of
                            // being skipped.
                            this.history.push({
                                queue: this.queue.slice(),
                                string: this.string,
                                history: this.history.slice()
                            });
                            var char = this.string[0];
                            this.string = this.string.substring(1);
                            return {
                                type: 'character',
                                char: char,
                                code: char.charCodeAt(0),
                                cat: data.cats.whitespace
                            }
                        } else if (catOf(this.string[0]) == data.cats.invalid) {
                            // Invalid characters are treated like they are of catcode 12 (characters that
                            // don't fit in in other catcodes). Later, they are recognized as an error and
                            // typeset in a red color, but for the purposes of parsing, they work as catcode
                            // 12 characters.
                            this.history.push({
                                queue: this.queue.slice(),
                                string: this.string,
                                history: this.history.slice()
                            });
                            var char = this.string[0];
                            this.string = this.string.substring(1);
                            return {
                                type: 'character',
                                char: char,
                                code: char.charCodeAt(0),
                                cat: data.cats.all,
                                invalid: true
                            }
                        }
                        break;

                    case 'argument':
                        // This context is used to get arguments for primitives and macros. It uses the
                        // default context to get the first token. If it's an opening token, all the tokens
                        // up to the closing token will be returned. Otherwise, the single token is re-
                        // turned. An example is \accent. \accent takes two arguments. The first is the
                        // charCode of the character to use as the accent. The second argument though can
                        // be anything, including a group of tokens. That's where this context comes in.

                        var mouth = new Mouth(this.string, this.queue),
                            groups = 0,
                            tokens = [];

                        while (true) {
                            var token = mouth.eat();

                            if (!token) {
                                break;
                            } else if (token.cat == data.cats.open) {
                                groups++;
                            } else if (token.cat == data.cats.close) {
                                groups--;
                            }
                            tokens.push(token);
                            if (groups == 0) break;
                        }
                        if (groups > 0 || tokens.length == 0) return null;
                        this.history.push({
                            queue: this.queue.slice(),
                            string: this.string,
                            history: this.history.slice()
                        });
                        mouth.finalize();
                        this.string = mouth.string;
                        return tokens;
                        break;

                    case 'integer':
                        // The integer context looks for an integer in the next available tokens. There are
                        // different syntaxes for numbers; all of them are described in detail in the TeX-
                        // book (pg. 269).

                        // A Mouth for the current Mouth is created so that any token eating is reversible.
                        var mouth = new Mouth(this.string, this.queue);

                        // This variable is always either 1 or -1 and keeps track of the sign of the num-
                        // ber. For every "-" that is encountered before the actual digits, this variable
                        // is multiplied by -1.
                        var sign = 1;

                        // The `context' variable keeps track of which tokens are allowed to appear next.
                        // For example, a "-" is allowed at the beginning of the number, but not after
                        // any digits have already been found.
                        var context = 'start';

                        // `digits' keep track of the numbers that have already been parsed. More numbers
                        // may be added on before it's finished.
                        var digits = 0;

                        // `found' is a boolean indicating if any actual digits were found. For example,
                        // --" is the start of a hexadecimal number, but no digits are actually defined.
                        // That has to be differentiated with --"0, which is a valid number translating
                        // to just 0.
                        var found = false;

                        // `mouthContext' is normally 'pre space'. While parsing, as a last resort, an un-
                        // signed int will be looked for using the unsigned int context. In order to do that
                        // though, the context needs to be changed to "unsigned int" instead of "pre space".
                        // If that still fails, then the loop is broken completely.
                        var mouthContext = 'pre space';

                        while (true) {
                            // `token' is what is going to be focused on for this iteration of the loop. Each
                            // loop gets a new token.
                            var token = mouth.eat(mouthContext);

                            // If there is no token, then the string has been exhausted and there's nothing
                            // left to parse.
                            if (!token) break;

                            if (context == 'start' && (token.type == 'command' || token.type == 'character' && token.cat == data.cats.active)) {
                                // Try to expand the command into tokens and parse from there. If the command is a
                                // \relax token though, stop parsing immediately. Only "expandable" commands are
                                // actually expanded. That's because if a \over for example is found, it's obvious-
                                // ly not going to add anything to the integer, but it WILL screw up the current
                                // scope by thinking it's supposed to be turned into a fraction before the integer
                                // is done being parsed. Register tokens are also allowed.
                                var macro = token.type == 'command' ? scopes.last.defs.primitive[token.name] || scopes.last.defs.macros[token.name] : scopes.last.defs.active[token.char];

                                if (macro && (
                                    (macro === data.defs.primitive.above           || macro.proxy && macro.original === data.defs.primitive.above)           ||
                                    (macro === data.defs.primitive.abovewithdelims || macro.proxy && macro.original === data.defs.primitive.abovewithdelims) ||
                                    (macro === data.defs.primitive.atop            || macro.proxy && macro.original === data.defs.primitive.atopwithdelims)  ||
                                    (macro === data.defs.primitive.atopwithdelims  || macro.proxy && macro.original === data.defs.primitive.atopwithdelims)  ||
                                    (macro === data.defs.primitive.over            || macro.proxy && macro.original === data.defs.primitive.over)            ||
                                    (macro === data.defs.primitive.overwithdelims  || macro.proxy && macro.original === data.defs.primitive.overwithdelims)  ||
                                    (macro === data.defs.primitive.begingroup      || macro.proxy && macro.original === data.defs.primitive.begingroup)      ||
                                    (macro === data.defs.primitive.endgroup        || macro.proxy && macro.original === data.defs.primitive.endgroup)        ||
                                    (macro === data.defs.primitive.left            || macro.proxy && macro.original === data.defs.primitive.left)            ||
                                    (macro === data.defs.primitive.right           || macro.proxy && macro.original === data.defs.primitive.right)           ||
                                    (macro === data.defs.primitive.edef            || macro.proxy && macro.original === data.defs.primitive.edef)            ||
                                    (macro === data.defs.primitive.gdef            || macro.proxy && macro.original === data.defs.primitive.gdef)            ||
                                    (macro === data.defs.primitive.xdef            || macro.proxy && macro.original === data.defs.primitive.xdef)            ||
                                    (macro === data.defs.primitive.let             || macro.proxy && macro.original === data.defs.primitive.let)             ||
                                    (macro === data.defs.primitive.futurelet       || macro.proxy && macro.original === data.defs.primitive.futurelet)       ||
                                    (macro === data.defs.primitive.global          || macro.proxy && macro.original === data.defs.primitive.global))) {
                                    mouth.revert();
                                    break;
                                }

                                var expansion = expand(token, mouth);

                                if (expansion.length == 1 && expansion[0] === token && token.invalid) {
                                    mouth.revert();
                                    break;
                                }
                                mouth.queue.unshift.apply(mouth.queue, expansion);
                                continue;
                            } else if (context == 'start' && token.cat == data.cats.whitespace) {
                                // A regular whitespace token was found. Just ignore and continue;
                                continue;
                            } else if (context == 'start' && token.cat == data.cats.all && token.char == '-') {
                                // A minus sign was found. Negate `sign' so that the final number will also be
                                // negated.
                                sign *= -1;
                            } else if (context == 'start' && token.cat == data.cats.all && token.char == '+') {
                                // A plus sign doesn't do anything to the sign, so it can just be ignored.
                                continue;
                            } else if (context == 'start' && token.register) {
                                // A register was found, like \count1 or \escapechar. It doesn't matter what type
                                // of register yet because all registers can be coerced into integers.
                                if (token.type == 'integer') {
                                    // Use the integers value.
                                    digits = token.value;
                                    mouthContext = 'pre space';
                                } else if (token.type == 'dimension') {
                                    // The `sp' value of a dimension is used as the integer. The `em' value is also
                                    // converted. 1em == 12 * 65536sp since 12 pt == 1rem. This assumes 1em == 1rem ==
                                    // 16px == 12pt, which is not always the case, but there's no way to know for sure
                                    // yet how many pixels 1em actually translates to.
                                    digits = token.sp.value + token.em.value * 12;
                                } else if (token.type == 'mu dimension') {
                                    // This uses the same logic as above. It assumes 18mu == 1em == 1rem == 16px ==
                                    // 12pt. 1mu == 12 / 18 * 65536sp.
                                    digits = token.mu.value * 12 / 18;
                                } else if (token.type == 'glue') {
                                    // Only the start dimension is considered for glue objects. Its dimension is co-
                                    // erced to an integer the same way as above.
                                    digits = token.start.sp.value + token.start.em.value * 12;
                                } else if (token.type == 'mu glue') {
                                    // Same logic for mu glue as for regular glue.
                                    digits = token.start.mu.value * 12 / 18;
                                }
                                found = true;
                                break;
                            } else if (context == 'start') {
                                mouthContext = 'unsigned int';
                                mouth.revert();
                            } else {
                                // A character was found that's not part of the number. Put the token back and fin-
                                // ish parsing.
                                mouth.revert();
                                break;
                            }
                        }
                        // Check if actual digits were found.
                        if (!found) return null;

                        // Multiple `digits' by `sign' to give the number its sign.
                        digits *= sign;
                        // Finalize any changes the Mouth made.
                        this.history.push({
                            queue: this.queue.slice(),
                            string: this.string,
                            history: this.history.slice()
                        });
                        mouth.finalize();
                        this.string = mouth.string;
                        // Create and return a new IntegerReg to hold the numerical value.
                        return new IntegerReg(digits);
                        break;

                    case 'dimension':
                        // A lot of what happens here is explained in the "number" case above, so there's
                        // gonna be a less comments here.
                        var mouth = new Mouth(this.string, this.queue);

                        // Digits are kept as a string here to be parsed as a float later. It's easier and
                        // leads to less loss of precision.
                        var sign = 1,
                            context = 'start',
                            foundFactor = false,
                            foundUnit = false,
                            digits = ' ',
                            sp = 0,
                            em = 0,
                            trueSpecified = false,
                            mouthContext = 'pre space';

                        while (!foundUnit) {
                            var token = mouth.eat(mouthContext);

                            if (!token) break;

                            if (context == 'start' && (token.type == 'command' || token.type == 'character' && token.cat == data.cats.active)) {
                                var macro = token.type == 'command' ? scopes.last.defs.primitive[token.name] || scopes.last.defs.macros[token.name] : scopes.last.defs.active[token.char];

                                if (macro && (
                                    (macro === data.defs.primitive.above           || macro.proxy && macro.original === data.defs.primitive.above)           ||
                                    (macro === data.defs.primitive.abovewithdelims || macro.proxy && macro.original === data.defs.primitive.abovewithdelims) ||
                                    (macro === data.defs.primitive.atop            || macro.proxy && macro.original === data.defs.primitive.atopwithdelims)  ||
                                    (macro === data.defs.primitive.atopwithdelims  || macro.proxy && macro.original === data.defs.primitive.atopwithdelims)  ||
                                    (macro === data.defs.primitive.over            || macro.proxy && macro.original === data.defs.primitive.over)            ||
                                    (macro === data.defs.primitive.overwithdelims  || macro.proxy && macro.original === data.defs.primitive.overwithdelims)  ||
                                    (macro === data.defs.primitive.begingroup      || macro.proxy && macro.original === data.defs.primitive.begingroup)      ||
                                    (macro === data.defs.primitive.endgroup        || macro.proxy && macro.original === data.defs.primitive.endgroup)        ||
                                    (macro === data.defs.primitive.left            || macro.proxy && macro.original === data.defs.primitive.left)            ||
                                    (macro === data.defs.primitive.right           || macro.proxy && macro.original === data.defs.primitive.right)           ||
                                    (macro === data.defs.primitive.edef            || macro.proxy && macro.original === data.defs.primitive.edef)            ||
                                    (macro === data.defs.primitive.gdef            || macro.proxy && macro.original === data.defs.primitive.gdef)            ||
                                    (macro === data.defs.primitive.xdef            || macro.proxy && macro.original === data.defs.primitive.xdef)            ||
                                    (macro === data.defs.primitive.let             || macro.proxy && macro.original === data.defs.primitive.let)             ||
                                    (macro === data.defs.primitive.futurelet       || macro.proxy && macro.original === data.defs.primitive.futurelet)       ||
                                    (macro === data.defs.primitive.global          || macro.proxy && macro.original === data.defs.primitive.global))) {
                                    mouth.revert();
                                    break;
                                }

                                var expansion = expand(token, mouth);

                                if (expansion.length == 1 && expansion[0] === token && token.invalid) {
                                    mouth.revert();
                                    break;
                                }
                                mouth.queue.unshift.apply(mouth.queue, expansion);
                                continue;
                            } else if (context == 'start' && token.cat == data.cats.whitespace) {
                                // A regular whitespace token was found. Just ignore and continue;
                                continue;
                            } else if (context == 'start' && token.cat == data.cats.all && token.char == '-') {
                                // A minus sign was found. Negate `sign' so that the final number will also be
                                // negated.
                                sign *= -1;
                            } else if (context == 'start' && token.cat == data.cats.all && token.char == '+') {
                                // A plus sign doesn't do anything to the sign, so it can just be ignored.
                                continue;
                            } else if (context == 'start' && !foundFactor && token.register) {
                                if (token.type == 'integer') {
                                    digits = token.value;
                                    // If there is a "decimal" message, then the integer is intended to be read as an
                                    // integer and is multiplied by 65536.
                                    if (token.message == 'decimal') digits /= 65536;
                                    digits = ' ' + digits;
                                    mouthContext = 'pre space';
                                    context = 'unit start'
                                } else if (token.type == 'dimension') {
                                    sp = token.sp.value;
                                    em = token.em.value;
                                    foundUnit = true;
                                } else if (token.type == 'mu dimension') {
                                    em = token.mu.value / 18;
                                    foundUnit = true;
                                } else if (token.type == 'glue') {
                                    sp = token.start.sp.value;
                                    em = token.start.em.value;
                                    foundUnit = true;
                                } else if (token.type == 'mu glue') {
                                    em = token.start.mu.value / 18;
                                    foundUnit = true;
                                }
                                foundFactor = true;
                                if (foundUnit) break;
                                continue;
                            } else if (foundFactor && context == 'unit start' && token.cat == data.cats.whitespace) {
                                context = 'unit start'
                            } else if (foundFactor && token.register) {
                                digits = parseFloat((digits + ' ').replace(' .', '.').replace('. ', '') || '0')
                                if (token.type == 'integer') {
                                    sp = digits * token.value;
                                } else if (token.type == 'dimension') {
                                    sp = digits * token.sp.value;
                                    em = digits * token.em.value;
                                } else if (token.type == 'mu dimension') {
                                    em = digits * token.mu.value / 18;
                                } else if (token.type == 'glue') {
                                    sp = digits * token.start.sp.value;
                                    em = digits * token.start.em.value;
                                } else if (token.type == 'mu glue') {
                                    em = digits * token.start.mu.value;
                                }
                                foundUnit = true;
                                break;
                            } else if (foundFactor && !trueSpecified && (token.char == 't' || token.char == 'T')) {
                                // Looks for the word "true".
                                var r = mouth.eat('pre space');
                                if (r && (r.char == 'r' || r.char == 'R') && r.cat != data.cats.active) {
                                    var u = mouth.eat('pre space');
                                    if (u && (u.char == 'u' || r.char == 'U') && u.cat != data.cats.active) {
                                        var e = mouth.eat('pre space');
                                        if (e && (e.char == 'e' || e.char == 'E') && e.cat != data.cats.active) {
                                            trueSpecified = true;
                                            context = 'unit start';
                                            continue;
                                        } else mouth.revert(4);
                                    } else mouth.revert(3);
                                } else mouth.revert(2);
                                break;
                            } else if (foundFactor && !trueSpecified && (token.char == 'e' || token.char == 'E')) {
                                // Looks for em or ex units. These aren't allowed with the "true" keyword.
                                var secondLetter = mouth.eat('pre space');
                                if (secondLetter && (secondLetter.char == 'm' || secondLetter.char == 'M') && secondLetter.cat != data.cats.active) {
                                    em = parseFloat((digits + ' ').replace(' .', '.').replace('. ', '') || '0') * 65536;
                                } else if (secondLetter && (secondLetter.char == 'x' || secondLetter.char == 'X') && secondLetter.cat != data.cats.active) {
                                    // Since DimenReg objects can only store values in em values, the ex unit has to be
                                    // converted to em units. Normally the ex unit depends on the font, but we don't
                                    // know the font yet. 1ex is assumed to be (233 / 480) em, which is about .48541666
                                    // of an em. That number was gotten by taking the ex-height of the serif, mono-
                                    // space, and sans-serif font and averaging them all out ((143 / 320) em, (157 /
                                    // 320) em, and (83 / 160) em, respectively) to get (233 / 480) em.
                                    em = parseFloat((digits + ' ').replace(' .', '.').replace('. ', '') || '0') * 233 / 480 * 65536;
                                } else {
                                    mouth.revert(2);
                                    break;
                                }
                                foundUnit = true;
                            } else if (foundFactor && (token.char == 'p' || token.char == 'P')) {
                                // Looks for "pt", "pc", and "px" ("px" isn't valid in TeX, but this is CSS, so it
                                // only makes sense that you're allowed to use px here too).
                                var secondLetter = mouth.eat('pre space');
                                if (secondLetter && (secondLetter.char == 't' || secondLetter.char == 'T') && secondLetter.cat != data.cats.active) {
                                    sp = parseFloat((digits + ' ').replace(' .', '.').replace('. ', '') || '0') * 65536;
                                    foundUnit = true;
                                } else if (secondLetter && (secondLetter.char == 'c' || secondLetter.char == 'C') && secondLetter.cat != data.cats.active) {
                                    sp = parseFloat((digits + ' ').replace(' .', '.').replace('. ', '') || '0') * 65536 * 12;
                                    foundUnit = true;
                                } else if (secondLetter && (secondLetter.char == 'x' || secondLetter.char == 'X') && secondLetter.cat != data.cats.active) {
                                    sp = parseFloat((digits + ' ').replace(' .', '.').replace('. ', '') || '0') * 65536 * 12 / 16;
                                    foundUnit = true;
                                } else {
                                    mouth.revert(2);
                                    break;
                                }
                            } else if (foundFactor && (token.char == 'i' || token.char == 'I')) {
                                var n = mouth.eat('pre space');
                                if (n && (n.char == 'n' || n.char == 'N') && n.cat != data.cats.active) {
                                    sp = parseFloat((digits + ' ').replace(' .', '.').replace('. ', '') || '0') * 65536 * 72;
                                    foundUnit = true;
                                } else {
                                    mouth.revert(2);
                                    break;
                                }
                            } else if (foundFactor && (token.char == 'b' || token.char == 'B')) {
                                var p = mouth.eat('pre space');
                                if (p && (p.char == 'p' || p.char == 'P') && p.cat != data.cats.active) {
                                    // 1bp is basically 1pt, so just use that.
                                    sp = parseFloat((digits + ' ').replace(' .', '.').replace('. ', '') || '0') * 65536;
                                    foundUnit = true;
                                } else {
                                    mouth.revert(2);
                                    break;
                                }
                            } else if (foundFactor && (token.char == 'c' || token.char == 'C')) {
                                var secondLetter = mouth.eat('pre space');
                                if (secondLetter && (secondLetter.char == 'm' || secondLetter.char == 'M') && secondLetter.cat != data.cats.active) {
                                    sp = parseFloat((digits + ' ').replace(' .', '.').replace('. ', '') || '0') * 65536 * 72 / 2.54;
                                    foundUnit = true;
                                } else if (secondLetter && (secondLetter.char == 'c' || secondLetter.char == 'C') && secondLetter.cat != data.cats.active) {
                                    sp = parseFloat((digits + ' ').replace(' .', '.').replace('. ', '') || '0') * 65536 * 1238 / 1157 * 12;
                                    foundUnit = true;
                                } else {
                                    mouth.revert(2);
                                    break;
                                }
                            } else if (foundFactor && (token.char == 'm' || token.char == 'M')) {
                                var m = mouth.eat('pre space');
                                if (m && (m.char == 'm' || m.char == 'M') && m.cat != data.cats.active) {
                                    sp = parseFloat((digits + ' ').replace(' .', '.').replace('. ', '') || '0') * 65536 * 72 / 2.54 / 10;
                                    foundUnit = true;
                                } else {
                                    mouth.revert(2);
                                    break;
                                }
                            } else if (foundFactor && (token.char == 'd' || token.char == 'D')) {
                                var d = mouth.eat('pre space');
                                if (d && (d.char == 'd' || d.char == 'D') && d.cat != data.cats.active) {
                                    sp = parseFloat((digits + ' ').replace(' .', '.').replace('. ', '') || '0') * 65536 * 1238 / 1157;
                                    foundUnit = true;
                                } else {
                                    mouth.revert(2);
                                    break;
                                }
                            } else if (foundFactor && (token.char == 's' || token.char == 'S')) {
                                var p = mouth.eat('pre space');
                                if (p && (p.char == 'p' || p.char == 'P') && p.cat != data.cats.active) {
                                    sp = parseFloat((digits + ' ').replace(' .', '.').replace('. ', '') || '0');
                                    foundUnit = true;
                                } else {
                                    mouth.revert(2);
                                    break;
                                }
                            } else if (context == 'start' && !foundFactor) {
                                mouthContext = 'factor';
                                mouth.revert();
                            } else {
                                mouth.revert();
                                break;
                            }
                        }

                        if (!foundFactor || !foundUnit) return null;
                        sp *= sign;
                        em *= sign;
                        this.history.push({
                            queue: this.queue.slice(),
                            string: this.string,
                            history: this.history.slice()
                        });
                        mouth.finalize();
                        this.string = mouth.string;
                        return trueSpecified ? new DimenReg(sp * 1000 / scopes.last.registers.named.mag.value, em * 1000 / scopes.last.registers.named.mag.value) : new DimenReg(sp, em);
                        break;

                    case 'mu dimension':
                        // Same thing as dimension except only math units are allowed.
                        var mouth = new Mouth(this.string, this.queue),
                            sign = 1,
                            context = 'start',
                            foundFactor = false,
                            foundUnit = false,
                            digits = ' ',
                            mu = 0,
                            trueSpecified = false,
                            mouthContext = 'pre space';

                        while (!foundUnit) {
                            var token = mouth.eat(mouthContext);

                            if (!token) break;

                            if (context == 'start' && (token.type == 'command' || token.type == 'character' && token.cat == data.cats.active)) {
                                var macro = token.type == 'command' ? scopes.last.defs.primitive[token.name] || scopes.last.defs.macros[token.name] : scopes.last.defs.active[token.char];

                                if (macro && (
                                    (macro === data.defs.primitive.above           || macro.proxy && macro.original === data.defs.primitive.above)           ||
                                    (macro === data.defs.primitive.abovewithdelims || macro.proxy && macro.original === data.defs.primitive.abovewithdelims) ||
                                    (macro === data.defs.primitive.atop            || macro.proxy && macro.original === data.defs.primitive.atopwithdelims)  ||
                                    (macro === data.defs.primitive.atopwithdelims  || macro.proxy && macro.original === data.defs.primitive.atopwithdelims)  ||
                                    (macro === data.defs.primitive.over            || macro.proxy && macro.original === data.defs.primitive.over)            ||
                                    (macro === data.defs.primitive.overwithdelims  || macro.proxy && macro.original === data.defs.primitive.overwithdelims)  ||
                                    (macro === data.defs.primitive.begingroup      || macro.proxy && macro.original === data.defs.primitive.begingroup)      ||
                                    (macro === data.defs.primitive.endgroup        || macro.proxy && macro.original === data.defs.primitive.endgroup)        ||
                                    (macro === data.defs.primitive.left            || macro.proxy && macro.original === data.defs.primitive.left)            ||
                                    (macro === data.defs.primitive.right           || macro.proxy && macro.original === data.defs.primitive.right)           ||
                                    (macro === data.defs.primitive.edef            || macro.proxy && macro.original === data.defs.primitive.edef)            ||
                                    (macro === data.defs.primitive.gdef            || macro.proxy && macro.original === data.defs.primitive.gdef)            ||
                                    (macro === data.defs.primitive.xdef            || macro.proxy && macro.original === data.defs.primitive.xdef)            ||
                                    (macro === data.defs.primitive.let             || macro.proxy && macro.original === data.defs.primitive.let)             ||
                                    (macro === data.defs.primitive.futurelet       || macro.proxy && macro.original === data.defs.primitive.futurelet)       ||
                                    (macro === data.defs.primitive.global          || macro.proxy && macro.original === data.defs.primitive.global))) {
                                    mouth.revert();
                                    break;
                                }

                                var expansion = expand(token, mouth);

                                if (expansion.length == 1 && expansion[0] === token && token.invalid) {
                                    mouth.revert();
                                    break;
                                }
                                mouth.queue.unshift.apply(mouth.queue, expansion);
                                continue;
                            } else if (context == 'start' && token.cat == data.cats.whitespace) {
                                continue;
                            } else if (context == 'start' && token.cat == data.cats.all && token.char == '-') {
                                sign *= -1;
                            } else if (context == 'start' && token.cat == data.cats.all && token.char == '+') {
                                continue;
                            } else if (context == 'start' && !foundFactor && token.register) {
                                if (token.type == 'integer') {
                                    digits = token.value;
                                    if (token.message == 'decimal') digits /= 65536;
                                    digits = ' ' + digits;
                                    mouthContext = 'pre space';
                                    context = 'unit start'
                                } else if (token.type == 'dimension') {
                                    mu = token.em.value * 18;
                                    foundUnit = true;
                                } else if (token.type == 'mu dimension') {
                                    mu = token.mu.value;
                                    foundUnit = true;
                                } else if (token.type == 'glue') {
                                    mu = token.start.em.value * 18;
                                    foundUnit = true;
                                } else if (token.type == 'mu glue') {
                                    mu = token.start.mu.value;
                                    foundUnit = true;
                                }
                                foundFactor = true;
                                if (foundUnit) break;
                                continue;
                            } else if (foundFactor && context == 'unit start' && token.cat == data.cats.whitespace) {
                                context = 'unit start'
                            } else if (foundFactor && token.register && token.type == 'mu glue') {
                                digits = parseFloat((digits + ' ').replace(' .', '.').replace('. ', '') || '0')
                                mu = digits * token.start.mu.value;
                                foundUnit = true;
                                break;
                            } else if (foundFactor && (token.char == 'm' || token.char == 'M')) {
                                var u = mouth.eat('pre space');
                                if (u && (u.char == 'u' || u.char == 'U') && u.cat != data.cats.active) {
                                    mu = parseFloat((digits + ' ').replace(' .', '.').replace('. ', '') || '0');
                                } else {
                                    mouth.revert(2);
                                    break;
                                }
                                foundUnit = true;
                            } else if (context == 'start' && !foundFactor) {
                                mouthContext = 'factor';
                                mouth.revert();
                            } else {
                                mouth.revert();
                                break;
                            }
                        }

                        if (!foundFactor || !foundUnit) return null;
                        mu *= sign;
                        this.history.push({
                            queue: this.queue.slice(),
                            string: this.string,
                            history: this.history.slice()
                        });
                        mouth.finalize();
                        this.string = mouth.string;
                        return new MuDimenReg(mu * 65536);
                        break;

                    case 'glue':
                        // Glues are basically just three dimensions joined together. The dimension context
                        // is used here to get the three dimensions, along with the factor context to get
                        // the factor of any fil(l)(l)s.

                        var mouth = new Mouth(this.string, this.queue),
                            sign = 1,
                            stretchSign = 1,
                            shrinkSign = 1,
                            context = 'start',
                            foundShrink = false,
                            foundStretch = false,
                            mouthContext = 'pre space',
                            lastState,
                            start,
                            stretch,
                            shrink;

                        while (true) {
                            var token = mouth.eat(mouthContext);

                            if (!token && !((context == 'post start' || context == 'stretch signs') && mouthContext == 'dimension') && !((context == 'post stretch' || context == 'shrink signs') && mouthContext == 'dimension')) {
                                if (lastState) mouth.loadState(lastState);
                                break;
                            }

                            if (!token && mouthContext == 'dimension') {
                                mouthContext = 'factor'
                            } else if ((context == 'start' || context == 'signs' || context == 'post start' || context == 'stretch signs' || context == 'post stretch' || context == 'shrink signs') && (token.type == 'command' || token.type == 'character' && token.cat == data.cats.active)) {
                                var macro = token.type == 'command' ? scopes.last.defs.primitive[token.name] || scopes.last.defs.macros[token.name] : scopes.last.defs.active[token.char];

                                if (macro && (
                                    (macro === data.defs.primitive.above           || macro.proxy && macro.original === data.defs.primitive.above)           ||
                                    (macro === data.defs.primitive.abovewithdelims || macro.proxy && macro.original === data.defs.primitive.abovewithdelims) ||
                                    (macro === data.defs.primitive.atop            || macro.proxy && macro.original === data.defs.primitive.atopwithdelims)  ||
                                    (macro === data.defs.primitive.atopwithdelims  || macro.proxy && macro.original === data.defs.primitive.atopwithdelims)  ||
                                    (macro === data.defs.primitive.over            || macro.proxy && macro.original === data.defs.primitive.over)            ||
                                    (macro === data.defs.primitive.overwithdelims  || macro.proxy && macro.original === data.defs.primitive.overwithdelims)  ||
                                    (macro === data.defs.primitive.begingroup      || macro.proxy && macro.original === data.defs.primitive.begingroup)      ||
                                    (macro === data.defs.primitive.endgroup        || macro.proxy && macro.original === data.defs.primitive.endgroup)        ||
                                    (macro === data.defs.primitive.left            || macro.proxy && macro.original === data.defs.primitive.left)            ||
                                    (macro === data.defs.primitive.right           || macro.proxy && macro.original === data.defs.primitive.right)           ||
                                    (macro === data.defs.primitive.edef            || macro.proxy && macro.original === data.defs.primitive.edef)            ||
                                    (macro === data.defs.primitive.gdef            || macro.proxy && macro.original === data.defs.primitive.gdef)            ||
                                    (macro === data.defs.primitive.xdef            || macro.proxy && macro.original === data.defs.primitive.xdef)            ||
                                    (macro === data.defs.primitive.let             || macro.proxy && macro.original === data.defs.primitive.let)             ||
                                    (macro === data.defs.primitive.futurelet       || macro.proxy && macro.original === data.defs.primitive.futurelet)       ||
                                    (macro === data.defs.primitive.global          || macro.proxy && macro.original === data.defs.primitive.global))) {
                                    mouth.revert();
                                    break;
                                }

                                var expansion = expand(token, mouth);

                                if (expansion.length == 1 && expansion[0] === token && token.invalid) {
                                    mouth.revert();
                                    break;
                                }
                                mouth.queue.unshift.apply(mouth.queue, expansion);
                                continue;
                            } else if ((context == 'start' || context == 'signs' || context == 'post start' || context == 'post stretch' || context == 'stretch signs' || context == 'shrink signs') && token.cat == data.cats.whitespace) {
                                continue;
                            } else if ((context == 'start' || context == 'signs') && token.cat == data.cats.all && token.char == '-') {
                                sign *= -1;
                                context == 'signs';
                            } else if ((context == 'start' || context == 'signs') && token.cat == data.cats.all && token.char == '+') {
                                context == 'signs';
                            } else if ((context == 'start' || context == 'signs') && token.register && token.type == 'glue') {
                                start = new DimenReg(token.start.sp.value * sign, token.start.em.value * sign);
                                stretch = new DimenReg(token.stretch.sp.value * sign, token.stretch.em.value * sign);
                                shrink = new DimenReg(token.shrink.sp.value * sign, token.shrink.em.value * sign);
                                foundStretch = foundShrink = true;
                                break;
                            } else if ((context == 'start' || context == 'signs') && token.register && token.type == 'dimension') {
                                start = new DimenReg(token.sp.value * sign, token.em.value * sign);
                                context = 'post start';
                                mouthContext = 'pre space';
                                mouth.saveState(lastState = Symbol());
                            } else if (context == 'start' || context == 'signs') {
                                mouthContext = 'dimension';
                                mouth.revert();
                            } else if (context == 'post start' && start && !foundStretch && !foundShrink && token.char == 'p') {
                                var l = mouth.eat('pre space');
                                if (l && (l.char == 'l' || l.char == 'L') && l.cat != data.cats.active) {
                                    var u = mouth.eat('pre space');
                                    if (u && (u.char == 'u' || u.char == 'U') && u.cat != data.cats.active) {
                                        var s = mouth.eat('pre space');
                                        if (s && (s.char == 's' || s.char == 'S') && s.cat != data.cats.active) {
                                            foundStretch = true;
                                            continue;
                                        }
                                    }
                                }
                                mouth.loadState(lastState);
                                break;
                            } else if (context == 'post start' && foundStretch && token.cat == data.cats.all && token.char == '-') {
                                stretchSign *= -1;
                                context = 'stretch signs';
                            } else if (context == 'post start' && foundStretch && token.cat == data.cats.all && token.char == '+') {
                                context = 'stretch signs';
                            } else if ((context == 'post start' || context == 'stretch signs') && foundStretch && token.register && token.type == 'dimension') {
                                stretch = new DimenReg(token.sp.value * stretchSign, token.em.value * shrinkSign);
                                context = 'post stretch';
                                mouthContext = 'pre space';
                                mouth.saveState(lastState = Symbol());
                            } else if ((context == 'post start' || context == 'stretch signs') && foundStretch && token.register && token.type == 'integer') {
                                mouthContext = 'pre space';
                                var f = mouth.eat();
                                if (f && (f.char == 'f' || f.char == 'F') && f.cat != data.cats.active) {
                                    var i = mouth.eat('pre space');
                                    if (i && (i.char == 'i' || i.char == 'I') && i.cat != data.cats.active) {
                                        var l = mouth.eat('pre space');
                                        if (l && (l.char == 'l' || l.char == 'L') && l.cat != data.cats.active) {
                                            l = mouth.eat('pre space');
                                            if (l && (l.char == 'l' || l.char == 'L') && l.cat != data.cats.active) {
                                                l = mouth.eat('pre space');
                                                if (l && (l.char == 'l' || l.char == 'L') && l.cat != data.cats.active) {
                                                    stretch = new InfDimen(token.value * stretchSign, 3);
                                                } else {
                                                    if (l) mouth.revert();
                                                    stretch = new InfDimen(token.value * stretchSign, 2);
                                                }
                                            } else {
                                                if (l) mouth.revert();
                                                stretch = new InfDimen(token.value * stretchSign, 1);
                                            }
                                            context = 'post stretch';
                                            mouth.saveState(lastState = Symbol());
                                            continue;
                                        }
                                    }
                                }
                                mouth.loadState(lastState);
                                break;
                            } else if ((context == 'post start' || context == 'stretch signs') && foundStretch) {
                                mouthContext = 'dimension';
                                mouth.revert();
                            } else if ((context == 'post start' && !foundStretch || context == 'post stretch') && !foundShrink && token.char == 'm') {
                                var i = mouth.eat('pre space');
                                if (i && (i.char == 'i' || i.char == 'I') && i.cat != data.cats.active) {
                                    var n = mouth.eat('pre space');
                                    if (n && (n.char == 'n' || n.char == 'N') && n.cat != data.cats.active) {
                                        var u = mouth.eat('pre space');
                                        if (u && (u.char == 'u' || u.char == 'U') && u.cat != data.cats.active) {
                                            var s = mouth.eat('pre space');
                                            if (s && (s.char == 's' || s.char == 'S') && s.cat != data.cats.active) {
                                                foundShrink = true;
                                                continue;
                                            }
                                        }
                                    }
                                }
                                mouth.loadState(lastState);
                                break;
                            } else if (context == 'post stretch' && foundShrink && token.cat == data.cats.all && token.char == '-') {
                                shrinkSign *= -1;
                                context = 'shrink signs';
                            } else if (context == 'post stretch' && foundShrink && token.cat == data.cats.all && token.char == '+') {
                                context = 'shrink signs';
                            } else if ((context == 'post stretch' || context == 'shrink signs' || context == 'post start') && foundShrink && token.register && token.type == 'dimension') {
                                shrink = new DimenReg(token.sp.value * shrinkSign, token.em.value * shrinkSign);
                                break;
                            } else if ((context == 'post stretch' || context == 'shrink signs' || context == 'post start') && foundShrink && token.register && token.type == 'integer') {
                                var f = mouth.eat();
                                if (f && (f.char == 'f' || f.char == 'F') && f.cat != data.cats.active) {
                                    var i = mouth.eat('pre space');
                                    if (i && (i.char == 'i' || i.char == 'I') && i.cat != data.cats.active) {
                                        var l = mouth.eat('pre space');
                                        if (l && (l.char == 'l' || l.char == 'L') && l.cat != data.cats.active) {
                                            l = mouth.eat('pre space');
                                            if (l && (l.char == 'l' || l.char == 'L') && l.cat != data.cats.active) {
                                                l = mouth.eat('pre space');
                                                if (l && (l.char == 'l' || l.char == 'L') && l.cat != data.cats.active) {
                                                    shrink = new InfDimen(token.value * shrinkSign, 3);
                                                } else {
                                                    if (l) mouth.revert();
                                                    shrink = new InfDimen(token.value * shrinkSign, 2);
                                                }
                                            } else {
                                                if (l) mouth.revert();
                                                shrink = new InfDimen(token.value * shrinkSign, 1);
                                            }
                                            break;
                                        }
                                    }
                                }
                                mouth.loadState(lastState);
                                break;
                            } else if ((context == 'post stretch' || context == 'shrink signs' || context == 'post start') && foundShrink) {
                                mouthContext = 'dimension';
                                mouth.revert();
                            } else {
                                if (lastState) mouth.loadState(lastState);
                                else mouth.revert();
                                break;
                            }
                        }

                        if (!start) return null;
                        this.history.push({
                            queue: this.queue.slice(),
                            string: this.string,
                            history: this.history.slice()
                        });
                        mouth.finalize();
                        this.string = mouth.string;
                        return new GlueReg(start, stretch, shrink);
                        break;

                    case 'mu glue':
                        // Same as glue but with math units.

                        var mouth = new Mouth(this.string, this.queue),
                            sign = 1,
                            stretchSign = 1,
                            shrinkSign = 1,
                            context = 'start',
                            foundShrink = false,
                            foundStretch = false,
                            mouthContext = 'pre space',
                            lastState,
                            start,
                            stretch,
                            shrink;

                        while (true) {
                            var token = mouth.eat(mouthContext);

                            if (!token && !((context == 'post start' || context == 'stretch signs') && mouthContext == 'mu dimension') && !((context == 'post stretch' || context == 'shrink signs') && mouthContext == 'mu dimension')) {
                                if (lastState) mouth.loadState(lastState);
                                break;
                            }

                            if (!token && mouthContext == 'mu dimension') {
                                mouthContext = 'factor'
                            } else if ((context == 'start' || context == 'signs' || context == 'post start' || context == 'stretch signs' || context == 'post stretch' || context == 'shrink signs') && (token.type == 'command' || token.type == 'character' && token.cat == data.cats.active)) {
                                var macro = token.type == 'command' ? scopes.last.defs.primitive[token.name] || scopes.last.defs.macros[token.name] : scopes.last.defs.active[token.char];

                                if (macro && (
                                    (macro === data.defs.primitive.above           || macro.proxy && macro.original === data.defs.primitive.above)           ||
                                    (macro === data.defs.primitive.abovewithdelims || macro.proxy && macro.original === data.defs.primitive.abovewithdelims) ||
                                    (macro === data.defs.primitive.atop            || macro.proxy && macro.original === data.defs.primitive.atopwithdelims)  ||
                                    (macro === data.defs.primitive.atopwithdelims  || macro.proxy && macro.original === data.defs.primitive.atopwithdelims)  ||
                                    (macro === data.defs.primitive.over            || macro.proxy && macro.original === data.defs.primitive.over)            ||
                                    (macro === data.defs.primitive.overwithdelims  || macro.proxy && macro.original === data.defs.primitive.overwithdelims)  ||
                                    (macro === data.defs.primitive.begingroup      || macro.proxy && macro.original === data.defs.primitive.begingroup)      ||
                                    (macro === data.defs.primitive.endgroup        || macro.proxy && macro.original === data.defs.primitive.endgroup)        ||
                                    (macro === data.defs.primitive.left            || macro.proxy && macro.original === data.defs.primitive.left)            ||
                                    (macro === data.defs.primitive.right           || macro.proxy && macro.original === data.defs.primitive.right)           ||
                                    (macro === data.defs.primitive.edef            || macro.proxy && macro.original === data.defs.primitive.edef)            ||
                                    (macro === data.defs.primitive.gdef            || macro.proxy && macro.original === data.defs.primitive.gdef)            ||
                                    (macro === data.defs.primitive.xdef            || macro.proxy && macro.original === data.defs.primitive.xdef)            ||
                                    (macro === data.defs.primitive.let             || macro.proxy && macro.original === data.defs.primitive.let)             ||
                                    (macro === data.defs.primitive.futurelet       || macro.proxy && macro.original === data.defs.primitive.futurelet)       ||
                                    (macro === data.defs.primitive.global          || macro.proxy && macro.original === data.defs.primitive.global))) {
                                    mouth.revert();
                                    break;
                                }

                                var expansion = expand(token, mouth);

                                if (expansion.length == 1 && expansion[0] === token && token.invalid) {
                                    mouth.revert();
                                    break;
                                }
                                mouth.queue.unshift.apply(mouth.queue, expansion);
                                continue;
                            } else if ((context == 'start' || context == 'signs' || context == 'post start' || context == 'post stretch' || context == 'stretch signs' || context == 'shrink signs') && token.cat == data.cats.whitespace) {
                                continue;
                            } else if ((context == 'start' || context == 'signs') && token.cat == data.cats.all && token.char == '-') {
                                sign *= -1;
                                context == 'signs';
                            } else if ((context == 'start' || context == 'signs') && token.cat == data.cats.all && token.char == '+') {
                                context == 'signs';
                            } else if ((context == 'start' || context == 'signs') && token.register && token.type == 'mu glue') {
                                start = new MuDimenReg(token.start.mu.value * sign);
                                stretch = new MuDimenReg(token.stretch.mu.value * sign);
                                shrink = new MuDimenReg(token.shrink.mu.value * sign);
                                foundStretch = foundShrink = true;
                                break;
                            } else if ((context == 'start' || context == 'signs') && token.register && token.type == 'mu dimension') {
                                start = new MuDimenReg(token.mu.value * sign);
                                context = 'post start';
                                mouthContext = 'pre space';
                                mouth.saveState(lastState = Symbol());
                            } else if (context == 'start' || context == 'signs') {
                                mouthContext = 'mu dimension';
                                mouth.revert();
                            } else if (context == 'post start' && start && !foundStretch && !foundShrink && token.char == 'p') {
                                var l = mouth.eat('pre space');
                                if (l && (l.char == 'l' || l.char == 'L') && l.cat != data.cats.active) {
                                    var u = mouth.eat('pre space');
                                    if (u && (u.char == 'u' || u.char == 'U') && u.cat != data.cats.active) {
                                        var s = mouth.eat('pre space');
                                        if (s && (s.char == 's' || s.char == 'S') && s.cat != data.cats.active) {
                                            foundStretch = true;
                                            continue;
                                        }
                                    }
                                }
                                mouth.loadState(lastState);
                                break;
                            } else if (context == 'post start' && foundStretch && token.cat == data.cats.all && token.char == '-') {
                                stretchSign *= -1;
                                context = 'stretch signs';
                            } else if (context == 'post start' && foundStretch && token.cat == data.cats.all && token.char == '+') {
                                context = 'stretch signs';
                            } else if ((context == 'post start' || context == 'stretch signs') && foundStretch && token.register && token.type == 'mu dimension') {
                                stretch = new MuDimenReg(token.mu.value * stretchSign);
                                context = 'post stretch';
                                mouthContext = 'pre space';
                                mouth.saveState(lastState = Symbol());
                            } else if ((context == 'post start' || context == 'stretch signs') && foundStretch && token.register && token.type == 'integer') {
                                mouthContext = 'pre space';
                                var f = mouth.eat();
                                if (f && (f.char == 'f' || f.char == 'F') && f.cat != data.cats.active) {
                                    var i = mouth.eat('pre space');
                                    if (i && (i.char == 'i' || i.char == 'I') && i.cat != data.cats.active) {
                                        var l = mouth.eat('pre space');
                                        if (l && (l.char == 'l' || l.char == 'L') && l.cat != data.cats.active) {
                                            l = mouth.eat('pre space');
                                            if (l && (l.char == 'l' || l.char == 'L') && l.cat != data.cats.active) {
                                                l = mouth.eat('pre space');
                                                if (l && (l.char == 'l' || l.char == 'L') && l.cat != data.cats.active) {
                                                    stretch = new InfDimen(token.value * stretchSign, 3);
                                                } else {
                                                    mouth.revert();
                                                    stretch = new InfDimen(token.value * stretchSign, 2);
                                                }
                                            } else {
                                                mouth.revert();
                                                stretch = new InfDimen(token.value * stretchSign, 1);
                                            }
                                            context = 'post stretch';
                                            mouth.saveState(lastState = Symbol());
                                            continue;
                                        }
                                    }
                                }
                                mouth.loadState(lastState);
                                break;
                            } else if ((context == 'post start' || context == 'stretch signs') && foundStretch) {
                                mouthContext = 'mu dimension';
                                mouth.revert();
                            } else if ((context == 'post start' && !foundStretch || context == 'post stretch') && !foundShrink && token.char == 'm') {
                                var i = mouth.eat('pre space');
                                if (i && (i.char == 'i' || i.char == 'I') && i.cat != data.cats.active) {
                                    var n = mouth.eat('pre space');
                                    if (n && (n.char == 'n' || n.char == 'N') && n.cat != data.cats.active) {
                                        var u = mouth.eat('pre space');
                                        if (u && (u.char == 'u' || u.char == 'U') && u.cat != data.cats.active) {
                                            var s = mouth.eat('pre space');
                                            if (s && (s.char == 's' || s.char == 'S') && s.cat != data.cats.active) {
                                                foundShrink = true;
                                                continue;
                                            }
                                        }
                                    }
                                }
                                mouth.loadState(lastState);
                                break;
                            } else if (context == 'post stretch' && foundShrink && token.cat == data.cats.all && token.char == '-') {
                                shrinkSign *= -1;
                                context = 'shrink signs';
                            } else if (context == 'post stretch' && foundShrink && token.cat == data.cats.all && token.char == '+') {
                                context = 'shrink signs';
                            } else if ((context == 'post stretch' || context == 'shrink signs' || context == 'post start') && foundShrink && token.register && token.type == 'mu dimension') {
                                shrink = new MuDimenReg(token.mu.value * shrinkSign);
                                break;
                            } else if ((context == 'post stretch' || context == 'shrink signs' || context == 'post start') && foundShrink && token.register && token.type == 'integer') {
                                var f = mouth.eat();
                                if (f && (f.char == 'f' || f.char == 'F') && f.cat != data.cats.active) {
                                    var i = mouth.eat('pre space');
                                    if (i && (i.char == 'i' || i.char == 'I') && i.cat != data.cats.active) {
                                        var l = mouth.eat('pre space');
                                        if (l && (l.char == 'l' || l.char == 'L') && l.cat != data.cats.active) {
                                            l = mouth.eat('pre space');
                                            if (l && (l.char == 'l' || l.char == 'L') && l.cat != data.cats.active) {
                                                l = mouth.eat('pre space');
                                                if (l && (l.char == 'l' || l.char == 'L') && l.cat != data.cats.active) {
                                                    shrink = new InfDimen(token.value * shrinkSign, 3);
                                                } else {
                                                    shrink = new InfDimen(token.value * shrinkSign, 2);
                                                }
                                            } else {
                                                shrink = new InfDimen(token.value * shrinkSign, 1);
                                            }
                                            break;
                                        }
                                    }
                                }
                                mouth.loadState(lastState);
                                break;
                            } else if ((context == 'post stretch' || context == 'shrink signs' || context == 'post start') && foundShrink) {
                                mouthContext = 'mu dimension';
                                mouth.revert();
                            } else {
                                if (lastState) mouth.loadState(lastState);
                                else mouth.revert();
                                break;
                            }
                        }

                        if (!start) return null;
                        this.history.push({
                            queue: this.queue.slice(),
                            string: this.string,
                            history: this.history.slice()
                        });
                        mouth.finalize();
                        this.string = mouth.string;
                        return new MuGlueReg(start, stretch, shrink);
                        break;

                    case 'unsigned int':
                        // This context looks for integers, like the integer context, except coerced int-
                        // egers (dimensions and glues cast into integers) and plus & minus signs aren't
                        // allowed. This context is used directly in the integer context and the factor
                        // context. Look in the integer context for comments on how tokens are being parsed
                        // here.

                        var mouth = new Mouth(this.string, this.queue),
                            context = 'start',
                            digits = 0,
                            found = false;

                        while (true) {
                            var token = mouth.eat('pre space');

                            if (!token) break;

                            // If the current context is "grave", then the last token that was parsed was a
                            // grave character (`). It makes the next token act as a number. If it's a char-
                            // acter token, the charCode of the character is used. If it's a command token, the
                            // token can only be one character in length and the charCode of that one character
                            // is used instead. This context has to come first because commands aren't supposed
                            // to be expanded. If the command expansion if block came first, it would be incor-
                            // rectly expanded.
                            if (context == 'grave') {
                                // Only a one-character-long command or an actual character can follow a grave
                                // character (`). If the command is more than one character long, then the whole
                                // number search is aborted and null is returned.
                                if (token.type == 'command' && token.name.length == 1) {
                                    digits = token.name.charCodeAt(0);
                                } else if (token.type == 'character') {
                                    digits = token.char.charCodeAt(0);
                                } else {
                                    return null;
                                }
                                found = true;
                                break;
                            } else if (context == 'start' && (token.type == 'command' || token.type == 'character' && token.cat == data.cats.active)) {
                                var macro = token.type == 'command' ? scopes.last.defs.primitive[token.name] || scopes.last.defs.macros[token.name] : scopes.last.defs.active[token.char];

                                if (macro && (
                                    (macro === data.defs.primitive.above           || macro.proxy && macro.original === data.defs.primitive.above)           ||
                                    (macro === data.defs.primitive.abovewithdelims || macro.proxy && macro.original === data.defs.primitive.abovewithdelims) ||
                                    (macro === data.defs.primitive.atop            || macro.proxy && macro.original === data.defs.primitive.atopwithdelims)  ||
                                    (macro === data.defs.primitive.atopwithdelims  || macro.proxy && macro.original === data.defs.primitive.atopwithdelims)  ||
                                    (macro === data.defs.primitive.over            || macro.proxy && macro.original === data.defs.primitive.over)            ||
                                    (macro === data.defs.primitive.overwithdelims  || macro.proxy && macro.original === data.defs.primitive.overwithdelims)  ||
                                    (macro === data.defs.primitive.begingroup      || macro.proxy && macro.original === data.defs.primitive.begingroup)      ||
                                    (macro === data.defs.primitive.endgroup        || macro.proxy && macro.original === data.defs.primitive.endgroup)        ||
                                    (macro === data.defs.primitive.left            || macro.proxy && macro.original === data.defs.primitive.left)            ||
                                    (macro === data.defs.primitive.right           || macro.proxy && macro.original === data.defs.primitive.right)           ||
                                    (macro === data.defs.primitive.edef            || macro.proxy && macro.original === data.defs.primitive.edef)            ||
                                    (macro === data.defs.primitive.gdef            || macro.proxy && macro.original === data.defs.primitive.gdef)            ||
                                    (macro === data.defs.primitive.xdef            || macro.proxy && macro.original === data.defs.primitive.xdef)            ||
                                    (macro === data.defs.primitive.let             || macro.proxy && macro.original === data.defs.primitive.let)             ||
                                    (macro === data.defs.primitive.futurelet       || macro.proxy && macro.original === data.defs.primitive.futurelet)       ||
                                    (macro === data.defs.primitive.global          || macro.proxy && macro.original === data.defs.primitive.global))) {
                                    mouth.revert();
                                    break;
                                }

                                var expansion = expand(token, mouth);

                                if (expansion.length == 1 && expansion[0] === token && token.invalid) {
                                    mouth.revert();
                                    break;
                                }
                                mouth.queue.unshift.apply(mouth.queue, expansion);
                                continue;
                            } else if (context == 'start' && token.cat == data.cats.whitespace) {
                                continue;
                            } else if (context == 'start' && token.register && token.type == 'integer') {
                                // An integer register was found. Only integer registers are allowed here. The reg-
                                // ister's value is copied into a new integer registered and returned.
                                digits = token.value;
                                found = true;
                                break;
                            } else if ((context == 'decimal' || context == 'start') && token.cat == data.cats.all && 47 < token.code && token.code < 58) {
                                // A regular digit (0-9) was found. The context changes and a new digit is added to
                                // `digits'.
                                digits = digits * 10 + +token.char;
                                context = 'decimal';
                                found = true;
                            } else if (context == 'start' && token.cat == data.cats.all && token.char == "'") {
                                // An octal indicator (') was found. Only octal digits are allowed after it.
                                context = 'octal';
                            } else if (context == 'start' && token.cat == data.cats.all && token.char == '"') {
                                // A hexadecimal indicator (") was found. Only hexadecimal digits are allowed after
                                // it.
                                context = 'hexadecimal';
                            } else if (context == 'start' && token.cat == data.cats.all && token.char == '`') {
                                // A grave character was found (`). The next token should be a character or a sin-
                                // gle character command. All that is handled above in the first `if' statement.
                                // This just changes the context.
                                context = 'grave';
                            } else if (context == 'octal' && token.cat == data.cats.all && 47 < token.code && token.code < 56) {
                                digits = digits * 8 + +token.char;
                                found = true;
                            } else if (context == 'hexadecimal' && ((token.cat == data.cats.all && 47 < token.code && token.code < 58) || ((token.cat == data.cats.all || token.cat == data.cats.letter) && 64 < token.code && token.code < 71))) {
                                digits = digits * 16 + parseInt(token.char, 16);
                                found = true;
                            } else {
                                // A character was found that's not part of the number. Put the token back and fin-
                                // ish parsing.
                                mouth.revert();
                                break;
                            }
                        }

                        if (!found) return null;
                        this.history.push({
                            queue: this.queue.slice(),
                            string: this.string,
                            history: this.history.slice()
                        });
                        mouth.finalize();
                        this.string = mouth.string;
                        return new IntegerReg(digits);
                        break;

                    case 'factor':
                        // This context is like a decimal context. It looks for any unsigned number and
                        // uses the unsigned int context to look for regular integers. It can also find
                        // fractional decimals though that us either a period or a comma as the decimal
                        // point. This context is used in the dimension and glue context. The reason it's
                        // called "factor" instead of "unsigned decimal" or something is because it is com-
                        // bined with a unit (e.g. 1.5em). It acts as a factor for a unit. Since decimal
                        // value are allowed here, but integer registers don't allow for decimals, the val-
                        // ue gotten here is multiplied by 65536. That way, a decimal like 0.5 can still be
                        // represented using the value 65536 * 0.5 = 32768.

                        // Digits is kept as a string here because it's easier to just add on a literal
                        // digit character after a decimal than figure out how much to multiply by and add.
                        // Plus it leads to less loss of precision because it's only being converted to a
                        // float once instead of constantly being multiplied and added to.
                        var mouth = new Mouth(this.string, this.queue),
                            context = 'start',
                            mouthContext = 'pre space',
                            found = true,
                            digits = '';

                        while (true) {
                            var token = mouth.eat(mouthContext);

                            if (!token) break;

                            if (context == 'start' && (token.type == 'command' || token.type == 'character' && token.cat == data.cats.active)) {
                                var macro = token.type == 'command' ? scopes.last.defs.primitive[token.name] || scopes.last.defs.macros[token.name] : scopes.last.defs.active[token.char];

                                if (macro && (
                                    (macro === data.defs.primitive.above           || macro.proxy && macro.original === data.defs.primitive.above)           ||
                                    (macro === data.defs.primitive.abovewithdelims || macro.proxy && macro.original === data.defs.primitive.abovewithdelims) ||
                                    (macro === data.defs.primitive.atop            || macro.proxy && macro.original === data.defs.primitive.atopwithdelims)  ||
                                    (macro === data.defs.primitive.atopwithdelims  || macro.proxy && macro.original === data.defs.primitive.atopwithdelims)  ||
                                    (macro === data.defs.primitive.over            || macro.proxy && macro.original === data.defs.primitive.over)            ||
                                    (macro === data.defs.primitive.overwithdelims  || macro.proxy && macro.original === data.defs.primitive.overwithdelims)  ||
                                    (macro === data.defs.primitive.begingroup      || macro.proxy && macro.original === data.defs.primitive.begingroup)      ||
                                    (macro === data.defs.primitive.endgroup        || macro.proxy && macro.original === data.defs.primitive.endgroup)        ||
                                    (macro === data.defs.primitive.left            || macro.proxy && macro.original === data.defs.primitive.left)            ||
                                    (macro === data.defs.primitive.right           || macro.proxy && macro.original === data.defs.primitive.right)           ||
                                    (macro === data.defs.primitive.edef            || macro.proxy && macro.original === data.defs.primitive.edef)            ||
                                    (macro === data.defs.primitive.gdef            || macro.proxy && macro.original === data.defs.primitive.gdef)            ||
                                    (macro === data.defs.primitive.xdef            || macro.proxy && macro.original === data.defs.primitive.xdef)            ||
                                    (macro === data.defs.primitive.let             || macro.proxy && macro.original === data.defs.primitive.let)             ||
                                    (macro === data.defs.primitive.futurelet       || macro.proxy && macro.original === data.defs.primitive.futurelet)       ||
                                    (macro === data.defs.primitive.global          || macro.proxy && macro.original === data.defs.primitive.global))) {
                                    mouth.revert();
                                    break;
                                }

                                var expansion = expand(token, mouth);

                                if (expansion.length == 1 && expansion[0] === token && token.invalid) {
                                    mouth.revert();
                                    break;
                                }
                                mouth.queue.unshift.apply(mouth.queue, expansion);
                                continue;
                            } else if (context == 'start' && token.cat == data.cats.whitespace) {
                                continue;
                            } else if (context == 'start' && token.register && token.type == 'integer') {
                                digits = token.value.toString();
                                found = true;
                                break;
                            } else if ((context == 'pre decimal' || context == 'start') && token.cat == data.cats.all && 47 < token.code && token.code < 58) {
                                digits += token.char;
                                context = 'pre decimal';
                                found = true;
                            } else if ((context == 'pre decimal' || context == 'start') && token.cat == data.cats.all && (token.char == '.' || token.char == ',')) {
                                digits += '.';
                                context = 'post decimal';
                                found = true;
                            } else if (context == 'post decimal' && token.cat == data.cats.all && 47 < token.code && token.code < 58) {
                                digits += token.char;
                            } else if (context == 'start') {
                                mouthContext = 'unsigned int';
                                mouth.revert();
                            } else {
                                mouth.revert();
                                break;
                            }
                        }

                        if (!found) return null;
                        this.history.push({
                            queue: this.queue.slice(),
                            string: this.string,
                            history: this.history.slice()
                        });
                        mouth.finalize();
                        this.string = mouth.string;
                        return new IntegerReg(digits * 65536, 'decimal');
                        break;
                }
            }

            // The `preview' function basically calls the eat function, saves the token, re-
            // verts the eating, and returns the token. It lets the caller get the first token
            // of the string/queue without making any changes to it.
            this.preview = function preview(context) {
                var token = this.eat(context);
                if (token) this.revert();
                return token;
            }

            // The `revert' function will revert the previous token. Basically, the Mouth ob-
            // ject's data will be rolled back to before the last token was parsed. This func-
            // tion does not revert finalized changes unless it's rolled back far enough and
            // then finalized again. If a numerical argument is provided, that function is re-
            // peated that many times.
            this.revert = function revert(times) {
                for (times = typeof times == 'number' ? times : 1; times > 0; times--) {
                    // If there is no history to go based off of, just return immediately
                    if (this.history.length == 0) return this;
                    // Replace all the data with the old data
                    this.string = this.history[this.history.length - 1].string;
                    for (var i = 0, l = this.history[this.history.length - 1].queue.length; i < l; i++) {
                        this.queue[i] = this.history[this.history.length - 1].queue[i];
                    }
                    this.queue.length = this.history[this.history.length - 1].queue.length;
                    this.history = this.history[this.history.length - 1].history;
                    // Returning `this' lets the script revert multiple times just by calling it over
                    // and over right after another.
                }
                return this;
            }

            // The `finalize' function will change the original queue array so that any changes
            // made in this function will be finalized. If an input string was provided as an
            // argument, it's up to the calling function to change the original string since
            // strings are immutable and the reference to the string can't be changed. If no
            // string was provided though, the outer `string' variable will be changed.
            this.finalize = function finalize() {
                for (var i = 0, l = this.queue.length; i < l; i++) {
                    (customQueue || queue)[i] = this.queue[i];
                }
                (customQueue || queue).length = this.queue.length;
                if (typeof customString != 'string') string = this.string;
            }

            // The `saveState' function, when called, saves the current state of the mouth in
            // the `savedStates' object. Then later, the Mouth can be restored back to the
            // state that was saved. It's like the revert function, except it doesn't have to
            // revert only to the last action.
            this.saveState = function saveState(label) {
                this.savedStates[label] = {
                    queue: this.queue.slice(),
                    string: this.string,
                    history: this.history.slice()
                };
                return this;
            }

            // The `loadState' function is kind of explained in the `saveState' documentation
            // comment above.
            this.loadState = function loadState(label) {
                this.string = this.savedStates[label].string;
                this.history = this.savedStates[label].history;
                for (var i = 0, l = this.savedStates[label].queue.length; i < l; i++) {
                    this.queue[i] = this.savedStates[label].queue[i];
                }
                this.queue.length = this.savedStates[label].queue.length;
                return this;
            }


            // The `expand' function will expand a command or active character token. If its
            // token argument is not a command or active character token, the token is returned
            // by itself in an array. Otherwise, the command / active character token is looked
            // up in the last Scope to replace it with its definition. The `mouth' argument is
            // used in case the command is a primitive that needs access to the next tokens.
            // Usually though, the mouth isn't even used at all.
            function expand(token, mouth) {
                if (!mouth) mouth = this;
                // First, check that the token is actually expandable.
                if (token && (token.type == 'command' || token.type == 'character' && token.cat == data.cats.active)) {
                    // Check if the token is invalid. If it is, that means it's already been expanded
                    // and failed. There's not point trying again. Just return an empty array.
                    if (token.invalid) {
                        var tokens = (token.type == 'command' ? token.escapeChar + token.name : token.char).split('');
                        tokens = tokens.map(function(element) {
                            return {
                                type: 'character',
                                cat: data.cats.all,
                                char: element,
                                code: element.charCodeAt(0),
                                invalid: true,
                                recognized: token.recognized
                            }
                        });
                        return [{type: 'character', cat: 1, char: '{', code: 0x007B, invalid: true}].concat(tokens).concat({type: 'character', cat: 2, char: '}', code: 0x007D, invalid: true});
                    };

                    // A token can also be ignorable. In which case, just return an empty array. This
                    // is used in case the token isn't invalid, but still needs to be skipped over.
                    if (token.ignore) return [{
                        type: 'ignored command',
                        token: token
                    }];

                    // Now, make sure the token has an actual definition.
                    if (token.type == 'command') {
                        // Look it up in the macro and primitive command objects.
                        if (token.name in scopes.last.defs.macros) {
                            // The command is a user-defined macro. It might be a simple replacement macro, or
                            // a \let for a primitive command.
                            if (scopes.last.defs.macros[token.name].proxy && scopes.last.defs.macros[token.name].original.type == 'primitive') {
                                // It's a primitive command. Run the primitive command's function.

                                var queuedToks = scopes.last.defs.macros[token.name].original.function.call(token, {
                                    mouth: mouth,
                                    tokens: scopes.last.tokens,
                                    toggles: prefixedToggles,
                                    catOf: catOf,
                                    mathCodeOf: mathCodeOf,
                                    scopes: scopes,
                                    openGroups: openGroups,
                                    contexts: contexts,
                                    Scope: Scope,
                                    style: style
                                });
                                return Array.isArray(queuedToks) ? queuedToks : [];
                            } else {
                                // It's a regular replacement macro. Substitute arguments in the replacement tokens
                                // for parameters, and return an array of the tokens.

                                var macro = scopes.last.defs.macros[token.name];

                                if (macro.proxy) macro = macro.original;

                                // Create a saved state in the Mouth in case the expansion fails.
                                var macroExpandSym = Symbol();
                                mouth.saveState(macroExpandSym);

                                // The `params' array keeps track of arguments to pass into the replacement text.
                                var params = [];
                                // First, iterate through the macro's parameter tokens to look for arguments for
                                // the replacement tokens.
                                for (var i = 0, l = macro.parameters.length; i < l; i++) {
                                    // There are two types of tokens: those with a param catcode (catcode 6), and all
                                    // other characters. If it has catcode 6, the tokens in the macro call will act as
                                    // arguments to be be used in the expansion text. If it's not a catcode 6 charac-
                                    // ter, it should match exactly with the tokens after the macro call.

                                    var tok = macro.parameters[i];
                                    if (tok.cat == data.cats.param) {
                                        // There can be two types of parameters. A parameter is considered delimited if
                                        // there are non-parameter tokens after it. Tokens will be absorbed until the
                                        // closing delimiter token is found. If a parameter is not delimited, only a
                                        // single token is absorbed and used as the argument.

                                        // Check if the token is delimited.
                                        if (macro.parameters[i + 1] && macro.parameters[i + 1].cat != data.cats.param) {
                                            // The token is delimited. Scan for tokens until the next token is found.

                                            // Keep track of what token to look out for.
                                            var next = macro.parameters[i + 1];

                                            // Add an array to `params'. Tokens will be added there.
                                            params.push([]);

                                            // This number keeps track of how many actual arguments were parsed. This may be
                                            // different from the number of tokens that were parsed. For example, if "{hi}" is
                                            // found, then it only counts as one argument, but as four tokens.
                                            tokensParsed = 0;

                                            // Continuously scan until the `next' token is found.
                                            while (true) {
                                                var otherTok = mouth.eat('argument');

                                                // If the string runs out of tokens, the call doesn't match its definition and the
                                                // original token should be returned as invalid.
                                                if (!otherTok) {
                                                    token.invalid = true;
                                                    token.recognized = true;
                                                    mouth.loadState(macroExpandSym);
                                                    return [token];
                                                }

                                                // Only the first token in the list is checked to see if it matches the `next' to-
                                                // ken. If it's only token long, then only it is checked. If it's multiple tokens
                                                // lone, then it means it's an enclosed group. Even if the `next' token was inside
                                                // the group, it can't be terminated inside because that would mean unbalanced de-
                                                // limiters for the group. Only the first token is checked because it's the only
                                                // spot where it would be allowed to stop absorbing.
                                                if (otherTok[0].type == next.type && otherTok[0].cat == next.cat && otherTok[0].code == next.code && otherTok[0].name == next.name) {
                                                    // If it did match, then it needs to be returned and the absorbing needs to stop.
                                                    mouth.revert();
                                                    break;
                                                }

                                                // The current token is not the delimiting closing token. It will be counted as
                                                // part of the argument and the scanning should continue.
                                                params[params.length - 1] = params[params.length - 1].concat(otherTok);

                                                // Increment `tokensParsed'.
                                                tokensParsed++;
                                            }
                                            // TeX removes the enclosing opening and closing tokens around an argument as long
                                            // as it won't unbalance the group delimiters. If `tokensParsed' is just one, then
                                            // opening and closing delimiters can be stripped. If it's more than one though,
                                            // then they can't (because then there would be an unmatched closing token in the
                                            // middle and an unmatched opening token after it).
                                            if (tokensParsed == 1 && params[params.length - 1][0].cat == data.cats.open && params[params.length - 1][params[params.length - 1].length - 1].cat == data.cats.close) {
                                                params[params.length - 1].shift();
                                                params[params.length - 1].pop();
                                            }
                                        } else {
                                            // The token is not delimited. Only one token should be absorbed and used as the
                                            // argument.

                                            var otherTok = mouth.eat('argument');

                                            // If there are no more tokens, return as an invalid command call.
                                            if (!otherTok) {
                                                token.invalid = true;
                                                recognized = true;
                                                mouth.loadState(macroExpandSym);
                                                return [token];
                                            }

                                            // If `otherTok' is more than just one token, it had to have been surrounded by
                                            // opening and closing delimiters, which TeX strips off automatically.
                                            if (otherTok.length > 1) {
                                                otherTok.shift();
                                                otherTok.pop();
                                            }

                                            // The token counts as an argument for the expansion.
                                            params.push(otherTok);
                                        }
                                    } else {
                                        // The token is not a parameter. It should be the same as the next token in the
                                        // macro call tokens.
                                        var otherTok = mouth.eat();
                                        // Check that the two tokens match.
                                        if (!(tok && otherTok && tok.type == otherTok.type && tok.cat == otherTok.cat && tok.code == otherTok.code && tok.name == otherTok.name)) {
                                            // The token does not match. The macro call does not match its definition and an
                                            // error would be thrown. Add an `invalid' property and return the initial token.
                                            token.invalid = true;
                                            token.recognized = true;
                                            // Revert the mouth to its original state before expansion.
                                            mouth.loadState(macroExpandSym);
                                            return [token];
                                        }
                                        // The two tokens match. No action needs to be taken.
                                    }
                                }

                                // All parameters have been found. Arguments are stored in the `params' array. The
                                // replacement tokens can reference arguments by their index. All that's left to do
                                // is evaluate the replacement tokens. Parameter tokens followed by a number will
                                // be replaced by the corresponding arguments. Parameter tokens followed by another
                                // token will be evaluated simply as a single parameter token. That lets other \def
                                // commands happen in replacement tokens (e.g. \def\cmdOne{\def\cmdTwo##1{##1}}, when
                                // called, will be replaced with the tokens \def\cmdTwo#1{#1}).

                                // `replacement' keeps track of the actual tokens that will be returned. These are
                                // the tokens that will be evaluated as a replacement for the macro.
                                var replacement = [];

                                // Loop through the tokens, replacing parameter tokens in the process.
                                for (var i = 0, l = macro.replacement.length; i < l; i++) {
                                    // Check if the current token is a parameter token.
                                    if (macro.replacement[i].cat == data.cats.param) {
                                        if (macro.replacement[i + 1].cat == data.cats.param) {
                                            // Replace with a regular parameter token (by deleting the first of the two para-
                                            // meter tokens).
                                            replacement.push(macro.replacement[i + 1]);
                                            i++;
                                        } else {
                                            // Look at the next token. It should be a number between 1-9 indicating which
                                            // argument should be used to replace it.
                                            var index = macro.replacement[i + 1].char - 1;
                                            if (index > params.length) {
                                                replacement = replacement.concat({
                                                    type: 'character',
                                                    cat: data.cats.all,
                                                    char: macro.replacement[i].char,
                                                    code: macros.replacement[i].code,
                                                    invalid: true
                                                });
                                            } else {
                                                replacement = replacement.concat(params[index]);
                                                i++;
                                            }
                                        }
                                    } else {
                                        // The token is a regular token. Clone it and add it directly to `replacement'. A
                                        // clone is made in case there is a problem while parsing the replacement. If there
                                        // IS a problem, an `invalid' property might be added to a token, but that should
                                        // not affect the original macro because then all subsequent calls to the macro
                                        // will also inherit that `invalid' property, even if it's not actually invalid.
                                        var clone = {}
                                        for (var key in macro.replacement[i]) {
                                            clone[key] = macro.replacement[i][key];
                                        }
                                        replacement.push(clone);
                                    }
                                }

                                return replacement;
                            }
                        } else if (token.name in scopes.last.defs.primitive) {
                            // The command is a primitive. Do the same thing that was done above where the
                            // function is called.
                            var queuedToks = scopes.last.defs.primitive[token.name].function.call(token, {
                                mouth: mouth,
                                tokens: scopes.last.tokens,
                                toggles: prefixedToggles,
                                catOf: catOf,
                                scopes: scopes,
                                openGroups: openGroups,
                                contexts: contexts,
                                Scope: Scope,
                                style: style
                            });
                            return Array.isArray(queuedToks) ? queuedToks : [];
                        } else if (token.name in scopes.last.registers.named) {
                            // The token points to a register. Return the value of the register.
                            return [scopes.last.registers.named[token.name]];
                        } else {
                            // There is no definition for the command. Return the token itself, but with an
                            // added `invalid' property so that it is typeset in a red color later.
                            token.invalid = true;
                            return [token];
                        }
                    } else if (token.type == 'character') {
                        // The token is an active character. It has to be looked up in the last Scope.
                        if (token.char in scopes.last.defs.active) {
                            // The active character has an actual definition. Now determine if it's a
                            // primitive command or a macro.
                            if (scopes.last.defs.active[token.char].proxy && scopes.last.defs.active[token.char].original.type == 'primitive') {
                                // It's a primitive command.
                                var queuedToks = scopes.last.defs.macros[token.char].function.call(token, {
                                    mouth: mouth,
                                    tokens: scopes.last.tokens,
                                    toggles: prefixedToggles,
                                    catOf: catOf,
                                    scopes: scopes,
                                    openGroups: openGroups,
                                    contexts: contexts,
                                    Scope: Scope,
                                    style: style
                                });
                                return Array.isArray(queuedToks) ? queuedToks : [];
                            } else {
                                // It's a macro. Do the same thing as what was done above for replacing a macro.
                                // Comments are excluded here since everything is explained above.

                                var macro = scopes.last.defs.active[token.char],
                                    activeExpandSym = Symbol();
                                mouth.saveState(activeExpandSym);
                                if (macro.proxy) macro = macro.original;
                                var params = [];
                                for (var i = 0, l = macro.parameters.length; i < l; i++) {
                                    var tok = macro.parameters[i];
                                    if (tok.cat == data.cats.param) {
                                        if (macro.parameters[i + 1] && macro.parameters[i + 1].cat != data.cats.param) {
                                            var next = macro.parameters[i + 1], tokensParsed = 0;
                                            params.push([]);
                                            while (true) {
                                                var otherTok = mouth.eat('argument');
                                                if (!otherTok) {
                                                    token.invalid = true;
                                                    token.recognized = true;
                                                    mouth.loadState(activeExpandSym);
                                                    return [token];
                                                }
                                                if (otherTok[0].type == next.type && otherTok[0].cat == next.cat && otherTok.code == next.code && otherTok.name == otherTok.name) {
                                                    // If it did match, then it needs to be returned and the absorbing needs to stop.
                                                    mouth.revert();
                                                    break;
                                                }
                                                params[params.length - 1].push(otherTok);
                                                tokensParsed++;
                                            }
                                            if (tokensParsed == 1 && params[params.length - 1][0].cat == data.cats.open && params[params.length - 1][params[params.length - 1].length - 1].cat == data.cats.close) {
                                                params[params.length - 1].shift();
                                                params[params.length - 1].pop();
                                            }
                                        } else {
                                            var otherTok = mouth.eat('argument');
                                            if (!otherTok) {
                                                token.invalid = true;
                                                token.recognized = true;
                                                mouth.loadState(activeExpandSym);
                                                return [token];
                                            }
                                            if (otherTok.length > 1) {
                                                otherTok.shift();
                                                otherTok.pop();
                                            }
                                            params.push([otherTok]);
                                        }
                                    } else {
                                        var otherTok = mouth.eat();
                                        if (!(tok && otherTok && tok.type == otherTok.type && tok.cat == otherTok.cat && tok.code == otherTok.code && tok.name == otherTok.name)) {
                                            token.invalid = true;
                                            token.recognized = true;
                                            mouth.loadState(activeExpandSym);
                                            return [token];
                                        }
                                    }
                                }
                                var replacement = [];
                                for (var i = 0, l = macro.replacement.length; i < l; i++) {
                                    if (macro.replacement[i].cat == data.cats.param) {
                                        if (macro.replacement[i + 1].cat == data.cats.param) {
                                            replacement.push(macro.replacement[i + 1]);
                                            i++;
                                        } else {
                                            replacement = replacement.concat(params[macro.replacement[i + 1].char - 1]);
                                            i++;
                                        }
                                    } else {
                                        var clone = {}
                                        for (var key in macro.replacement[i]) {
                                            clone[key] = macro.replacement[i][key];
                                        }
                                        replacement.push(clone);
                                    }
                                }
                                return replacement;
                            }
                        } else {
                            // There's no definition for the character. Return it by itself in an array with an
                            // added `invalid' property.
                            token.invalid = true;
                            return [token];
                        }
                    }
                } else {
                    // The token isn't a command or active character; just return it by itself in an
                    // array.
                    return [token];
                }
            }

            this.expand = expand;
        }

        // The Scope class is used in the `scopes' array. Each new Scope object will clone
        // the `data' object, or its surrounding scope. All scopes inherit from `data', ei-
        // ther directly or indirectly, and all changes made on a Scope are propagated to
        // all nested Scopes.
        function Scope() {
            // Get the Scope to inherit from.
            var parent = this.parentScope = scopes.last || data;
            this.defs = {
                primitive: {},
                macros: {},
                active: {}
            };
            this.registers = {
                count: {},
                dimen: {},
                skip: {},
                muskip: {},
                named: {}
            };
            this.cats = {}
            this.mathcodes = parent.mathcodes.slice();
            this.lc = {};
            this.uc = {};
            this.font = {}

            for (var key in parent.defs.primitive) this.defs.primitive[key] = parent.defs.primitive[key];
            for (key in parent.defs.macros) this.defs.macros[key] = parent.defs.macros[key];
            for (key in parent.defs.active) this.defs.active[key] = parent.defs.active[key];
            for (key in parent.lc) this.lc[key] = new IntegerReg(parent.lc[key]);
            for (key in parent.uc) this.uc[key] = new IntegerReg(parent.uc[key]);
            for (key in parent.font) this.font[key] = parent.font[key];
            for (key in parent.cats) !isNaN(key) && (this.cats[key] = new IntegerReg(parent.cats[key]));
            for (key in parent.registers.count) this.registers.count[key] = new IntegerReg(parent.registers.count[key]);
            for (key in parent.registers.dimen) this.registers.dimen[key] = new DimenReg(parent.registers.dimen[key]);
            for (key in parent.registers.skip) this.registers.skip[key] = new GlueReg(parent.registers.skip[key]);
            for (key in parent.registers.muskip) this.registers.muskip[key] = new MuGlueReg(parent.registers.muskip[key]);
            for (key in parent.registers.named) {
                var reg = parent.registers.named[key],
                    type = reg.type == 'integer' ? 'count' : reg.type == 'dimension' ? 'dimen' : reg.type == 'glue' ? 'skip' : 'muskip',
                    regs = Object.values(parent.registers[type]);
                if (regs.includes(reg)) {
                    for (var number in parent.registers[type]) {
                        if (parent.registers.named[key] === parent.registers[type][number]) {
                            this.registers.named[key] = this.registers[type][number];
                        }
                    }
                } else this.registers.named[key] = new (reg.type == 'integer' ? IntegerReg : reg.type == 'dimension' ? DimenReg : reg.type == 'glue' ? GlueReg : MuGlueReg)(reg);
            }

            // Tokens are added to each scope's list of tokens. When a scope is closed, its to-
            // kens are added to the global list of tokens.
            this.tokens = [];

            // Once for every scope, there is allowed to be a command like \over. It splits the
            // scope into two (and creates a fraction), but it can only happen once per scope.
            // This boolean keeps track if one has already been found for this scope.
            this.split = false;

            // Add this Scope to the end of the `scope' array.
            scopes.push(this);
        }

        // The `catOf' function returns the catcode of the given string's first character.
        // The catcode table of the last scope in the scope chain is used. This function
        // is used a lot in `Mouth.eat' to parse strings into tokens.
        function catOf(char) {
            if (!char) return null;
            char = char.charCodeAt(0);
            if (!(char in scopes.last.cats)) return data.cats.all;
            return scopes.last.cats[char].value;
        }

        // This function helps in looking up what family a character would normally be a
        // part of. For example, "1" is a regular Ord character while "+" would be a Bin
        // character. "=" would be a Rel character, and so on.
        function mathCodeOf(charCode) {
            var char = String.fromCharCode(charCode);
            for (var mathcode = 0; mathcode < 9; mathcode++) {
                if (scopes.last.mathcodes[mathcode].includes(char)) return mathcode;
            }
            return 0;
        }





        // Everything up to this point has been functions and variables. Here is where the
        // actual parsing starts.

        var mouth = new Mouth();

        // This variable keeps track of how many groups are open. Every time a new group is
        // opened, the opening token is added to the array. When a matching closing token
        // is found, the opening token is removed. If all the tokens are parsed and there
        // are still open groups, all the opening tokens in the array are marked as inval-
        // id.
        var openGroups = [];

        // `lastWasMath' is a boolean indicating if the last parsed token was a math shift
        // token. If the style is "display", then it requires two consecutive math shift
        // tokens to leave. If one is found, then this boolean is changed to true. If a-
        // nother math shift token is found, and this boolean is true, it means it's time
        // to exit math mode. If a non-math shift token is found, then the original is
        // marked invalid and the parsing continues.
        var lastWasMath = false;
        while (true) {
            var token = mouth.eat();

            if (token === null) {
                return [[], TeXstring, false];
            }

            if (token.type == 'command' || token.type == 'character' && token.cat == data.cats.active) {
                if (contexts.last == 'mathchoice') contexts.last.failed();
                var expansion = mouth.expand(token, mouth);
                mouth.queue.unshift.apply(mouth.queue, expansion);
                continue;
            }

            if (token.type == 'character' && token.cat == data.cats.param) {
                // Parameter tokens are only allowed in certain contexts. If they aren't in their
                // intended context, they are invalid. The expression below adds an invalid char-
                // acter token to the mouth's queue so that it's parsed next. It will be added as
                // a regular, invalid token.
                if (contexts.last == 'mathchoice') contexts.last.failed();

                mouth.queue.unshift({
                    type: 'character',
                    cat: data.cats.all,
                    char: token.char,
                    code: token.code,
                    invalid: true
                });
            } else if (token.type == 'character' && token.cat == data.cats.math) {
                // If a math shift token is found, it might be to terminate the TeX parser. If the
                // style is in display, then the next token should also be a math shift token.
                if (contexts.last == 'mathchoice') contexts.last.failed();

                if (style == 'display') {
                    if (lastWasMath) break;
                    lastWasMath = token;
                    var atom = {
                        type: 'atom',
                        atomType: 1,
                        nucleus: {
                            type: 'symbol',
                            char: token.char,
                            code: token.code
                        },
                        superscript: null,
                        subscript: null,
                        ignore: true
                    }

                    if (contexts.last == 'superscript') {
                        for (var i = scopes.last.tokens.length - 1; i >= 0; i--) {
                            if (scopes.last.tokens[i].type == 'atom') {
                                scopes.last.tokens[i].superscript = [atom];
                                break;
                            }
                        }
                        contexts.pop();
                    } else if (contexts.last == 'subscript') {
                        for (var i = scopes.last.tokens.length - 1; i >= 0; i--) {
                            if (scopes.last.tokens[i].type == 'atom') {
                                scopes.last.tokens[i].subscript = [atom];
                                break;
                            }
                        }
                        contexts.pop();
                    } else {
                        scopes.last.tokens.push(atom);
                    }
                } else break;
            } else if (token.type == 'character' && token.cat == data.cats.super) {
                // A superscript character (usually ^) is used to modify the last atom. First the
                // last atom is found, even if the last token in the list is not an atom. Once that
                // atom is found, it has to be checked. If it already has a superscript attached to
                // it, then the current superscript is considered invalid. Otherwise, the context
                // is changed so that the next atom to be parsed will be added on to the previous
                // atom instead of being its own.
                if (contexts.last == 'mathchoice') contexts.last.failed();

                // Keep track of the atom to add superscript to.
                var atom;
                for (var i = scopes.last.tokens.length - 1; i >= 0; i--) {
                    if (scopes.last.tokens[i].type == 'atom') {
                        atom = scopes.last.tokens[i];
                        break;
                    }
                }
                // If no previous atom was found, then a new, empty one has to be made and added on
                // to `scopes.last.tokens'.
                if (!atom) {
                    scopes.last.tokens.push({
                        type: 'atom',
                        atomType: 0,
                        nucleus: null,
                        superscript: null,
                        subscript: null
                    });
                    atom = scopes.last.tokens[scopes.last.tokens.length - 1];
                }

                if (atom.superscript) {
                    // The atom already has a superscript. The current superscript is treated as an in-
                    // valid character.
                    scopes.last.tokens.push({
                        type: 'atom',
                        atomType: 0,
                        nucleus: {
                            type: 'symbol',
                            char: token.char,
                            code: token.code,
                            invalid: true
                        },
                        superscript: null,
                        subscript: null
                    });
                } else if (contexts.last == 'superscript') {
                    // If a superscript context is already open, then the current superscript token is
                    // invalid.
                    atom.superscript = {
                        type: 'symbol',
                        char: token.char,
                        code: token.code,
                        invalid: true
                    }
                    contexts.pop();
                } else if (contexts.last == 'subscript') {
                    // Same for subscript.
                    atom.subscript = {
                        type: 'symbol',
                        char: token.char,
                        code: token.code,
                        invalid: true
                    }
                    contexts.pop();
                } else contexts.push('superscript');
            } else if (token.type == 'character' && token.cat == data.cats.sub) {
                // Do the same thing as what was done for superscript atoms.
                if (contexts.last == 'mathchoice') contexts.last.failed();

                var atom;
                for (var i = scopes.last.tokens.length - 1; i >= 0; i--) {
                    if (scopes.last.tokens[i].type == 'atom') {
                        atom = scopes.last.tokens[i];
                        break;
                    }
                }
                if (!atom) {
                    scopes.last.tokens.push({
                        type: 'atom',
                        atomType: 0,
                        nucleus: null,
                        superscript: null,
                        subscript: null
                    });
                    atom = scopes.last.tokens[scopes.last.tokens.length - 1];
                }

                if (atom.subscript) {
                    scopes.last.tokens.push({
                        type: 'atom',
                        atomType: 0,
                        nucleus: {
                            type: 'symbol',
                            char: token.char,
                            code: token.code,
                            invalid: true
                        },
                        superscript: null,
                        subscript: null
                    });
                } else if (contexts.last == 'superscript') {
                    atom.superscript = {
                        type: 'symbol',
                        char: token.char,
                        code: token.code,
                        invalid: true
                    }
                    contexts.pop();
                } else if (contexts.last == 'subscript') {
                    atom.subscript = {
                        type: 'symbol',
                        char: token.char,
                        code: token.code,
                        invalid: true
                    }
                    contexts.pop();
                } else contexts.push('subscript');
            } else if (token.type == 'character' && token.cat == data.cats.open) {
                // A token was found that opens a new group and scope. Add a temporary token that
                // can be marked invalid if the group is never closed.
                var atom = {
                    type: 'atom',
                    atomType: 0,
                    nucleus: {
                        type: 'symbol',
                        char: token.char,
                        code: token.code
                    },
                    superscript: null,
                    subscript: null,
                    ignore: true
                }

                openGroups.push(atom);
                contexts.push('scope');
                new Scope();
                scopes.last.tokens.push(atom);
            } else if (token.type == 'character' && token.cat == data.cats.close) {
                // A token was found that closes groups and scopes. If there are no open groups,
                // then it is marked as invalid. If the last scope was opened via a \left, it is
                // also marked as invalid.
                if (!openGroups.length || scopes.last.delimited || scopes.last.semisimple || scopes.last.isHalign || scopes.last.isHalignCell || contexts.last != 'scope') {
                    // If the character is invalid, an invalid character token is created and passed to
                    // the mouth so it can be treated like a regular character.
                    mouth.queue.unshift({
                        type: 'character',
                        cat: data.cats.all,
                        char: token.char,
                        code: token.code,
                        invalid: true
                    });
                } else {
                    token.opener = openGroups[openGroups.length - 1];
                    token.opener.closer = token;
                    openGroups.pop();

                    // A scope is about to be closed. All its tokes need to be added to its parent's
                    // list of tokens.

                    contexts.pop();

                    if (scopes.last.isFrac) {
                        var tokens = [{
                            type: 'atom',
                            atomType: 'inner',
                            nucleus: [{
                                type: 'fraction',
                                numerator: scopes.last.fracNumerator,
                                denominator: scopes.last.tokens,
                                barWidth: scopes.last.barWidth,
                                delims: [scopes.last.fracLeftDelim, scopes.last.fracRightDelim],
                                nullDelimiterSpace: new DimenReg(scopes.last.registers.named.nulldelimiterspace)
                            }],
                            superscript: null,
                            subscript: null
                        }];
                    } else var tokens = scopes.last.tokens;

                    if (contexts.last == 'superscript') {
                        scopes.pop();
                        for (var i = scopes.last.tokens.length - 1; i >= 0; i--) {
                            if (scopes.last.tokens[i].type == 'atom') {
                                scopes.last.tokens[i].superscript = tokens;
                                break;
                            }
                        }
                        contexts.pop();
                    } else if (contexts.last == 'subscript') {
                        scopes.pop();
                        for (var i = scopes.last.tokens.length - 1; i >= 0; i--) {
                            if (scopes.last.tokens[i].type == 'atom') {
                                scopes.last.tokens[i].subscript = tokens;
                                break;
                            }
                        }
                        contexts.pop();
                    } else {
                        if (scopes.last.isFrac) {
                            scopes.pop();
                            scopes.last.tokens.push(tokens[0]);
                        } else {
                            scopes.pop();
                            scopes.last.tokens.push({
                                type: 'atom',
                                atomType: 0,
                                nucleus: tokens,
                                superscript: null,
                                subscript: null
                            });
                        }

                        // If it was the fourth mathchoice group, the \mathchoice has succeeded and its
                        // context needs to be closed.
                        if (contexts.last == 'mathchoice' && ++contexts.last.current == 4) contexts.last.succeeded();
                    }
                }
            } else if (token.type == 'character' && token.cat == data.cats.alignment) {
                // Alignment characters are used in tables to separate cells in a row. Each cell
                // inherits a preamble where some tokens are added to the end of the cell's con-
                // tent. The tokens are still unparsed though, so they need to be passed through
                // this parser first. To do that, all the tokens are added to the mouth, along
                // with the current token. Then, after all the tokens have been parsed and this
                // token is found again, the cell is done parsing and should move on to the next.
                if (contexts.last == 'mathchoice') contexts.last.failed();

                // Alignment characters are only allowed in the context of a table. If it's not in
                // that context, mark it as invalid.
                if (!scopes.last.isHalignCell || contexts.last != 'scope') {
                    mouth.queue.unshift({
                        type: 'character',
                        cat: data.cats.all,
                        char: token.char,
                        code: token.code,
                        invalid: true
                    });
                    continue;
                }

                // If this is the first time the token is found, the preamble tokens should be
                // added to the mouth first along with the current token. If the cell was marked
                // as `omit' though, then the preamble doesn't apply to it, so it's the same as
                // if this is the second time the token was found.
                var row = scopes[scopes.length - 2].cellData[scopes[scopes.length - 2].cellData.length - 1],
                    halignScope = scopes[scopes.length - 2];
                if (!row[row.length - 1].omit && !token.postPreamble) {
                    var column = -1,
                        tokens;
                    for (var i = 0, l = row.length; i < l; i++) {
                        column += row[i].span;
                    }
                    // Here, the preamble's tokens are inserted into the mouth's queue and the loop
                    // continues parsing. First, the right preamble cell has to be gotten. If the pre-
                    // amble is repeating (specified with a double alignment token in the \halign),
                    // then the repeatable cells have to be repeated until the current column's index
                    // is reached. If the preamble doesn't repeat forever and it doesn't specify a
                    // cell for the current column, then the alignment token is marked as invalid since
                    // there's too many cells already.
                    if (halignScope.preamble[column]) {
                        // A regular preamble cell was found, no repeating necessary.
                        tokens = halignScope.preamble[column][1];
                    } else if (~halignScope.repeatPreambleAt) {
                        // The preamble doesn't have a cell for the column, so it needs to repeated until
                        // one's found.

                        // First get the subarray that's the repeatable section of the preamble.
                        var repeatable = halignScope.preamble.slice(halignScope.repeatPreambleAt, halignScope.preamble.length);
                        // Get the cell in the subarray that holds the tokens needed.
                        tokens = repeatable[(column - halignScope.repeatPreambleAt) % repeatable.length][1];
                    } else {
                        // There aren't enough cells in the preamble and it can't be repeated. Mark the
                        // alignment character as invalid.
                        mouth.queue.unshift({
                            type: 'character',
                            cat: data.cats.all,
                            char: token.char,
                            code: token.code,
                            invalid: true
                        });
                        continue;
                    }
                    // Since this will be creating a new cell, which will also need a preamble, check
                    // that the preamble is long enough for that too.
                    if (!halignScope.preamble[++column] && !~halignScope.repeatPreambleAt) {
                        mouth.queue.unshift({
                            type: 'character',
                            cat: data.cats.all,
                            char: token.char,
                            code: token.code,
                            invalid: true
                        });
                        continue;
                    }
                    mouth.queue.unshift.apply(mouth.queue, tokens.concat(token));
                    token.postPreamble = true;
                    continue;
                }

                // At this point, the preamble should have been parsed if there was one. Now, the
                // cell is ready to be closed to move on to the next one.

                contexts.pop();
                var tokens = scopes.last.tokens;
                if (scopes.last.isFrac) {
                    row[row.length - 1].content.push({
                        type: 'atom',
                        atomType: 'inner',
                        nucleus: [{
                            type: 'fraction',
                            numerator: scopes.last.fracNumerator,
                            denominator: tokens,
                            barWidth: scopes.last.barWidth,
                            delims: [scopes.last.fracLeftDelim, scopes.last.fracRightDelim],
                            nullDelimiterSpace: new DimenReg(scopes.last.registers.named.nulldelimiterspace)
                        }],
                        superscript: null,
                        subscript: null
                    });
                    scopes.pop();
                } else {
                    scopes.pop();
                    row[row.length - 1].content = row[row.length - 1].content.concat(tokens);
                }

                var alignOmitSym = Symbol();
                mouth.saveState(alignOmitSym);

                // Now, add a new cell to the scope.
                row.push({
                    type: 'cell',
                    content: [],
                    omit: false,
                    span: 1
                });

                // Check to see if \omit follows the alignment token. If it does, the preamble
                // won't be used for that cell.
                while (true) {
                    var token = mouth.eat();

                    if (!token) {
                        mouth.loadState(alignOmitSym);
                        break;
                    } else if (token.type == 'character' && token.cat != data.cats.active) {
                        mouth.loadState(alignOmitSym);
                        break;
                    } else if (token.type == 'command' || token.type == 'character' && token.cat == data.cats.active) {
                        if (token.name in scopes.last.registers.named) {
                            mouth.loadState(alignOmitSym);
                            break;
                        }

                        var macro = token.type == 'command' ? scopes.last.defs.primitive[token.name] || scopes.last.defs.macros[token.name] : scopes.last.defs.active[token.char];

                        if (!macro) {
                            mouth.loadState(alignOmitSym);
                            break;
                        }
                        if ((macro === data.defs.primitive.the          || macro.proxy && macro.original === data.defs.primitive.the)          ||
                            (macro === data.defs.primitive.expandafter  || macro.proxy && macro.original === data.defs.primitive.expandafter)  ||
                            (macro === data.defs.primitive.number       || macro.proxy && macro.original === data.defs.primitive.number)       ||
                            (macro === data.defs.primitive.romannumeral || macro.proxy && macro.original === data.defs.primitive.romannumeral) ||
                            (macro === data.defs.primitive.csname       || macro.proxy && macro.original === data.defs.primitive.csname)       ||
                            (macro === data.defs.primitive.string       || macro.proxy && macro.original === data.defs.primitive.string)       ||
                            (macro === data.defs.primitive.if           || macro.isLet && macro.original === data.defs.primitive.if)           ||
                            (macro === data.defs.primitive.ifcase       || macro.isLet && macro.original === data.defs.primitive.ifcase)       ||
                            (macro === data.defs.primitive.ifcat        || macro.isLet && macro.original === data.defs.primitive.ifcat)        ||
                            (macro === data.defs.primitive.ifdim        || macro.isLet && macro.original === data.defs.primitive.ifdim)        ||
                            (macro === data.defs.primitive.ifeof        || macro.isLet && macro.original === data.defs.primitive.ifeof)        ||
                            (macro === data.defs.primitive.iffalse      || macro.isLet && macro.original === data.defs.primitive.iffalse)      ||
                            (macro === data.defs.primitive.ifodd        || macro.isLet && macro.original === data.defs.primitive.ifodd)        ||
                            (macro === data.defs.primitive.ifnum        || macro.isLet && macro.original === data.defs.primitive.ifnum)        ||
                            (macro === data.defs.primitive.ifhmode      || macro.isLet && macro.original === data.defs.primitive.ifhmode)      ||
                            (macro === data.defs.primitive.ifinner      || macro.isLet && macro.original === data.defs.primitive.ifinner)      ||
                            (macro === data.defs.primitive.ifmmode      || macro.isLet && macro.original === data.defs.primitive.ifmmode)      ||
                            (macro === data.defs.primitive.iftrue       || macro.isLet && macro.original === data.defs.primitive.iftrue)       ||
                            (macro === data.defs.primitive.ifvmode      || macro.isLet && macro.original === data.defs.primitive.ifvmode)      ||
                            (macro === data.defs.primitive.ifvoid       || macro.isLet && macro.original === data.defs.primitive.ifvoid)       ||
                            (macro === data.defs.primitive.ifx          || macro.isLet && macro.original === data.defs.primitive.ifx)) {
                            var expansion = mouth.expand(token, mouth);
                            if (expansion.length == 1 && expansion[0] === token && token.invalid) {
                                mouth.loadState(alignOmitSym);
                                break;
                            }
                            mouth.queue.unshift.apply(mouth.queue, expansion);
                            continue;
                        } else if (macro === data.defs.primitive.omit || macro.proxy && macro.original === data.defs.primitive.omit) {
                            row[row.length - 1].omit = true;
                            break;
                        }

                        if (macro.type == 'primitive' || macro.proxy && macro.original.type == 'primitive') {
                            mouth.loadState(alignOmitSym);
                            break;
                        }

                        var expansion = mouth.expand(token, mouth);
                        if (expansion.length == 1 && expansion[0] ==- token && token.invalid) {
                            mouth.loadState(alignOmitSym);
                            break;
                        }
                        mouth.queue.unshift.apply(mouth.queue, expansion);
                    }
                }

                // Open a new scope for the new cell.
                contexts.push('scope');
                new Scope();
                scopes.last.isHalignCell = true;

                // If the cell wasn't marked as `omit', the preamble for the new column needs to be
                // evaluated.
                if (!row[row.length - 1].omit) {
                    var column = -1;
                    for (var i = 0, l = row.length; i < l; i++) {
                        column += row[i].span;
                    }
                    if (halignScope.preamble[column]) {
                        tokens = halignScope.preamble[column][0];
                    } else if (~halignScope.repeatPreambleAt) {
                        var repeatable = halignScope.preamble.slice(halignScope.repeatPreambleAt, halignScope.preamble.length);
                        tokens = repeatable[(column - halignScope.repeatPreambleAt) % repeatable.length][0];
                    }
                    mouth.queue.unshift.apply(mouth.queue, tokens);
                }
            } else if (token.type == 'character') {
                // A regular character was found.
                if (contexts.last == 'mathchoice') contexts.last.failed();

                var char = {
                    type: 'symbol',
                    char: token.char,
                    code: token.code
                }
                if (token.invalid) char.invalid = true;

                // The mathcode of the character is gotten first. If it's mathcode 8, then its
                // active character definition i used instead (pretty much only for the apostrophe
                // character).
                var mathcode = mathCodeOf(char.code);

                // If a token is part of an invalid command name, it may be marked as `recognized',
                // which indicated that the command exists, but wasn't used correctly. These types
                // of atoms are rendered in normal upright font, so they should have a mathcode of
                // 0 (Ord) instead of 7 (Variable, rendered in italics).
                if (token.invalid && token.recognized) mathcode = 0;

                if (mathcode == data.mathcodes.active) {
                    // A character with a mathcode of 8 is replaced with its active character defin-
                    // ition.
                    mouth.queue.unshift({
                        type: 'character',
                        cat: data.cats.active,
                        char: char.char,
                        code: char.code
                    });
                    continue;
                }

                if (contexts.last == 'superscript') {
                    // Superscripts and subscripts are kept best as entire atoms, even if they're just
                    // single characters. That's because when they're being rendered, it's easier to
                    // just render an entire atom than to shorten it into just one character.
                    for (var i = scopes.last.tokens.length - 1; i >= 0; i--) {
                        if (scopes.last.tokens[i].type == 'atom') {
                            scopes.last.tokens[i].superscript = [{
                                type: 'atom',
                                atomType: mathcode,
                                nucleus: char,
                                superscript: null,
                                subscript: null
                            }];
                            break;
                        }
                    }
                    contexts.pop();
                } else if (contexts.last == 'subscript') {
                    // Do the same thing for subscripts.
                    for (var i = scopes.last.tokens.length - 1; i >= 0; i--) {
                        if (scopes.last.tokens[i].type == 'atom') {
                            scopes.last.tokens[i].subscript = [{
                                type: 'atom',
                                atomType: mathcode,
                                nucleus: char,
                                superscript: null,
                                subscript: null
                            }];
                            break;
                        }
                    }
                    contexts.pop();
                } else {
                    // Add it as a regular atom.
                    scopes.last.tokens.push({
                        type: 'atom',
                        atomType: mathcode,
                        nucleus: char,
                        superscript: null,
                        subscript: null
                    });
                }
            } else if (token.register) {
                // If there's a register token, it means the user referenced one using a command
                // like \count or \escapechar. It should be followed by as assignment.
                if (contexts.last == 'mathchoice') contexts.last.failed();

                // First look for an equals sign. If one isn't found, then the token that was eaten
                // is returned.

                var regAssignment = Symbol()
                mouth.saveState(regAssignment);
                var optEquals = mouth.eat();
                if (!optEquals || optEquals.type != 'character' || optEquals.char != '=' || optEquals.cat != data.cats.all) optEquals && mouth.revert();

                // Now, look for the new value for the register.
                if (token.type == 'integer') {
                    var integer = mouth.eat('integer');

                    if (!integer) mouth.loadState(regAssignment);
                    else {
                        // First, the original token is saved.
                        var oldTok = token;
                        // Then, if \global is active, all the registers from the current scope up to the
                        // global on are all changed to the new value. If \global is inactive, nothing
                        // happens.
                        if (prefixedToggles.global && scopes.last.registers.named.globaldefs.value >= 0 || scopes.last.registers.named.globaldefs.value > 0) {
                            while (token.parent) {
                                token = token.parent;
                                token.value = integer.value;
                            }
                        }
                        // Now, the original token is changed. The reason the original token is changed af-
                        // ter all the global changes have been made is that if the current count register
                        // is referring to \globaldefs, then the \global has to be detected before it is
                        // changed. If the original token was changed first, the the if block right after
                        // would only consider its new value, not the value it was at when the definition
                        // was made. This only happens when changing integer registers because it's the
                        // only one affected by this problem. For other types of registers, the original
                        // token can be changed before or after the if block and it wouldn't made a dif-
                        // ference.
                        oldTok.value = integer.value;
                        prefixedToggles.global = false;
                    }
                } else if (token.type == 'dimension') {
                    var dimen = mouth.eat('dimension');

                    if (!dimen) mouth.loadState(regAssignment);
                    else {
                        token.sp.value = dimen.sp.value;
                        token.em.value = dimen.em.value;
                        if (prefixedToggles.global && scopes.last.registers.named.globaldefs.value >= 0 || scopes.last.registers.named.globaldefs.value > 0) {
                            while (token.parent) {
                                token = token.parent;
                                token.sp.value = dimen.sp.value;
                                token.em.value = dimen.em.value;
                            }
                        }
                        prefixedToggles.global = false;
                    }
                } else if (token.type == 'mu dimension') {
                    var dimen = mouth.eat('mu dimension');

                    if (!dimen) mouth.loadState(regAssignment);
                    else {
                        token.mu.value = dimen.mu.value;
                        if (prefixedToggles.global && scopes.last.registers.named.globaldefs.value >= 0 || scopes.last.registers.named.globaldefs.value > 0) {
                            while (token.parent) {
                                token = token.parent;
                                token.mu.value = integer.mu.value;
                            }
                        }
                        prefixedToggles.global = false;
                    }
                } else if (token.type == 'glue') {
                    var glue = mouth.eat('glue');

                    if (!glue) mouth.loadState(regAssignment);
                    else {
                        token.start.sp.value = glue.start.sp.value;
                        token.start.em.value = glue.start.em.value;
                        if (glue.stretch.type == 'infinite dimension') token.stretch = new InfDimen(glue.stretch.number.value, glue.stretch.magnitude.value);
                        else token.stretch = new DimenReg(glue.stretch.sp.value, glue.stretch.em.value);
                        if (glue.shrink.type == 'infinite dimension') token.shrink = new InfDimen(glue.shrink.number.value, glue.shrink.magnitude.value);
                        else token.shrink = new DimenReg(glue.shrink.sp.value, glue.shrink.em.value);
                        if (prefixedToggles.global && scopes.last.registers.named.globaldefs.value >= 0 || scopes.last.registers.named.globaldefs.value > 0) {
                            while (token.parent) {
                                token = token.parent;
                                token.start.sp.value = glue.start.sp.value;
                                token.start.em.value = glue.start.em.value;
                                if (glue.stretch.type == 'infinite dimension') token.stretch = new InfDimen(glue.stretch.number.value, glue.stretch.magnitude.value);
                                else token.stretch = new DimenReg(glue.stretch.sp.value, glue.stretch.em.value);
                                if (glue.shrink.type == 'infinite dimension') token.shrink = new InfDimen(glue.shrink.number.value, glue.shrink.magnitude.value);
                                else token.shrink = new DimenReg(glue.shrink.sp.value, glue.shrink.em.value);
                            }
                        }
                        prefixedToggles.global = false;
                    }
                } else if (token.type == 'mu glue') {
                    var glue = mouth.eat('mu glue');

                    if (!glue) mouth.loadState(regAssignment);
                    else {
                        token.start.mu.value = glue.start.mu.value;
                        if (glue.stretch.type == 'infinite dimension') token.stretch = new InfDimen(glue.stretch.number.value, glue.stretch.magnitude.value);
                        else token.stretch = new MuDimenReg(glue.stretch.mu.value);
                        if (glue.shrink.type == 'infinite dimension') token.shrink = new InfDimen(glue.shrink.number.value, glue.shrink.magnitude.value);
                        else token.shrink = new MuDimenReg(glue.shrink.mu.value);
                        if (prefixedToggles.global && scopes.last.registers.named.globaldefs.value >= 0 || scopes.last.registers.named.globaldefs.value > 0) {
                            while (token.parent) {
                                token = token.parent;
                                token.start.mu.value = glue.start.mu.value;
                                if (glue.stretch.type == 'infinite dimension') token.stretch = new InfDimen(glue.stretch.number.value, glue.stretch.magnitude.value);
                                else token.stretch = new MuDimenReg(glue.stretch.mu.value);
                                if (glue.shrink.type == 'infinite dimension') token.shrink = new InfDimen(glue.shrink.number.value, glue.shrink.magnitude.value);
                                else token.shrink = new MuDimenReg(glue.shrink.mu.value);
                            }
                        }
                        prefixedToggles.global = false;
                    }
                }
            } else if (token.type == 'ignored command') {
                scopes.last.tokens.push(token.token);
                continue;
            }

            if (lastWasMath) lastWasMath.invalid = true;

            // At this point, any toggles should have been resolved. If there are any toggles
            // still on after a token was already parsed, then that toggle is invalid.
            for (var toggle in prefixedToggles) {
                if (prefixedToggles[toggle]) {
                    prefixedToggles[toggle].invalid = true;
                    prefixedToggles[toggle] = false;
                }
            }
        }

        // Now, all the unclosed scopes need to be closed so that they all collapse into
        // one group of tokens.
        while (scopes.last != scopes[0]) {
            contexts.pop();
            var tokens = scopes.last.tokens;

            if (contexts.last == 'superscript') {
                scopes.pop();
                for (var i = scopes.last.tokens.length - 1; i >= 0; i--) {
                    if (scopes.last.tokens[i].type == 'atom') {
                        scopes.last.tokens[i].superscript = tokens;
                        break;
                    }
                }
                contexts.pop();
            } else if (contexts.last == 'subscript') {
                scopes.pop();
                for (var i = scopes.last.tokens.length - 1; i >= 0; i--) {
                    if (scopes.last.tokens[i].type == 'atom') {
                        scopes.last.tokens[i].subscript = tokens;
                        break;
                    }
                }
                contexts.pop();
            } else {
                if (scopes.last.isFrac) {
                    scopes[scopes.length - 2].tokens.push({
                        type: 'atom',
                        atomType: 'inner',
                        nucleus: [{
                            type: 'fraction',
                            numerator: scopes.last.fracNumerator,
                            denominator: tokens,
                            barWidth: scopes.last.barWidth,
                            delims: [scopes.last.fracLeftDelim, scopes.last.fracRightDelim],
                            nullDelimiterSpace: new DimenReg(scopes.last.registers.named.nulldelimiterspace)
                        }],
                        superscript: null,
                        subscript: null
                    });
                    scopes.pop();
                } else {
                    scopes.pop();
                    scopes.last.tokens.push({
                        type: 'atom',
                        atomType: 0,
                        nucleus: tokens,
                        superscript: null,
                        subscript: null
                    });
                }
            }
        }

        // If the global scope was a fraction, it should be collapsed into one.
        if (scopes[0].isFrac) {
            var tokens = scopes[0].tokens;

            scopes[0].tokens = [{
                type: 'atom',
                atomType: 'inner',
                nucleus: [{
                    type: 'fraction',
                    numerator: scopes[0].fracNumerator,
                    denominator: tokens,
                    barWidth: scopes[0].barWidth,
                    delims: [scopes[0].fracLeftDelim, scopes[0].fracRightDelim],
                    nullDelimiterSpace: new DimenReg(scopes[0].registers.named.nulldelimiterspace)
                }],
                superscript: null,
                subscript: null
            }];
        }

        // Now, go back and mark any unclosed groups as invalid. That includes any opening
        // characters (like {) or \left commands.
        for (var i = 0, l = openGroups.length; i < l; i++) {
            openGroups[i].invalid = true;
        }

        // Now, any tokens marked with an `ignore' property need to be removed, unless they
        // were also marked as invalid.
        function removeIgnored(tokens) {
            for (var i = 0, l = tokens.length; i < l; i++) {
                if (tokens[i].ignore && tokens[i].type == 'command') {
                    if (tokens[i].invalid) {
                        var toks = (tokens[i].escapeChar + tokens[i].name).split('').map(function(element) {
                            return {
                                type: 'atom',
                                atomType: tokens[i].recognized ? 0 : 7,
                                nucleus: {
                                    type: 'symbol',
                                    char: element,
                                    code: element.charCodeAt(0),
                                    invalid: true
                                },
                                superscript: null,
                                subscript: null
                            };
                        });
                        tokens.splice(i, 1, {
                            type: 'atom',
                            atomType: 0,
                            nucleus: toks,
                            superscript: null,
                            subscript: null
                        });
                    } else tokens.splice(i, 1);
                    l = tokens.length;
                    i--;
                } else if (tokens[i].ignore && !tokens[i].invalid) {
                    tokens.splice(i, 1);
                    l = tokens.length;
                    i--;
                } else if (tokens[i].type == 'fraction') {
                    removeIgnored(tokens[i].numerator);
                    removeIgnored(tokens[i].denominator);
                } else if (tokens[i].type == 'table') {
                    for (var i = 0, l = tokens[i].cellData.length; i < l; i++) {
                        for (var n = 0, j = tokens[i].cellData[i].length; n < j; n++) {
                            removeIgnored(tokens[i][n].content);
                        }
                    }
                } else if (tokens[i].type == 'atom') {
                    if (Array.isArray(tokens[i].nucleus)) removeIgnored(tokens[i].nucleus);
                    if (Array.isArray(tokens[i].superscript)) removeIgnored(tokens[i].superscript);
                    if (Array.isArray(tokens[i].subscript)) removeIgnored(tokens[i].subscript);
                } else if (tokens[i].type == 'mathchoice') {
                    removeIgnored(tokens[i].groups);
                }
            }
        }
        removeIgnored(scopes[0].tokens);

        // Now, "accent modifier" tokens are looked for. If the next token is an atom, the
        // entire nucleus is wrapped into an Acc atom and the "accent modifier" token is
        // removed. If the next token is NOT an atom, the "accent modifier" token is re-
        // placed with an invalid command atom.
        function resolveAccents(tokens) {
            for (var i = 0, l = tokens.length; i < l; i++) {
                if (tokens[i].type == 'accent modifier') {
                    if (tokens[i + 1] && tokens[i + 1].type == 'atom') {
                        tokens.splice(i, 2, {
                            type: 'atom',
                            atomType: 'acc',
                            nucleus: [tokens[i + 1]],
                            superscript: tokens[i + 1].superscript,
                            subscript: tokens[i + 1].subscript,
                            accChar: tokens[i].char,
                            accCode: tokens[i].code
                        });
                        tokens[i].nucleus[0].superscript = null;
                        tokens[i].nucleus[0].subscript = null;
                        l = tokens.length;
                        i--;
                    } else {
                        var toks = (tokens[i].token.type == 'command' ? tokens[i].token.escapeChar + tokens[i].token.name : tokens[i].token.char).split('').map(function(element) {
                            return {
                                type: 'atom',
                                atomType: 0,
                                nucleus: {
                                    type: 'symbol',
                                    char: element,
                                    code: element.charCodeAt(0),
                                    invalid: true
                                },
                                superscript: null,
                                subscript: null
                            };
                        });
                        tokens[i] = {
                            type: 'atom',
                            atomType: 0,
                            nucleus: toks,
                            superscript: null,
                            subscript: null
                        };
                    }
                } else if (tokens[i].type == 'fraction') {
                    resolveAccents(tokens[i].numerator);
                    resolveAccents(tokens[i].denominator);
                } else if (tokens[i].type == 'table') {
                    for (var i = 0, l = tokens[i].cellData.length; i < l; i++) {
                        for (var n = 0, j = tokens[i].cellData[i].length; n < j; n++) {
                            resolveAccents(tokens[i][n].content);
                        }
                    }
                } else if (tokens[i].type == 'atom') {
                    if (Array.isArray(tokens[i].nucleus)) resolveAccents(tokens[i].nucleus);
                    if (Array.isArray(tokens[i].superscript)) resolveAccents(tokens[i].superscript);
                    if (Array.isArray(tokens[i].subscript)) resolveAccents(tokens[i].subscript);
                } else if (tokens[i].type == 'mathchoice') {
                    resolveAccents(tokens[i].groups);
                }
            }
        }
        resolveAccents(scopes[0].tokens);

        // Math family tokens like \mathbin and \overline are resolved here.
        function resolveFamilies(tokens) {
            for (var i = 0, l = tokens.length; i < l; i++) {
                if (tokens[i].type == 'family modifier') {
                    if (tokens[i + 1] && tokens[i + 1].type == 'atom') {
                        tokens.splice(i, 2, {
                            type: 'atom',
                            atomType: tokens[i].value,
                            nucleus: [tokens[i + 1]],
                            superscript: tokens[i + 1].superscript,
                            subscript: tokens[i + 1].subscript
                        });
                        tokens[i].nucleus[0].superscript = null;
                        tokens[i].nucleus[0].subscript = null;
                        l = tokens.length;
                        i--;
                    } else {
                        var toks = (tokens[i].token.type == 'command' ? tokens[i].token.escapeChar + tokens[i].token.name : tokens[i].token.char).split('').map(function(element) {
                            return {
                                type: 'atom',
                                atomType: 0,
                                nucleus: {
                                    type: 'symbol',
                                    char: element,
                                    code: element.charCodeAt(0),
                                    invalid: true
                                },
                                superscript: null,
                                subscript: null
                            };
                        });
                        tokens[i] = {
                            type: 'atom',
                            atomType: 0,
                            nucleus: toks,
                            superscript: null,
                            subscript: null
                        };
                    }
                } else if (tokens[i].type == 'fraction') {
                    resolveFamilies(tokens[i].numerator);
                    resolveFamilies(tokens[i].denominator);
                } else if (tokens[i].type == 'table') {
                    for (var i = 0, l = tokens[i].cellData.length; i < l; i++) {
                        for (var n = 0, j = tokens[i].cellData[i].length; n < j; n++) {
                            resolveFamilies(tokens[i][n].content);
                        }
                    }
                } else if (tokens[i].type == 'atom') {
                    if (Array.isArray(tokens[i].nucleus)) resolveFamilies(tokens[i].nucleus);
                    if (Array.isArray(tokens[i].superscript)) resolveFamilies(tokens[i].superscript);
                    if (Array.isArray(tokens[i].subscript)) resolveFamilies(tokens[i].subscript);
                } else if (tokens[i].type == 'mathchoice') {
                    resolveFamilies(tokens[i].groups);
                }
            }
        }
        resolveFamilies(scopes[0].tokens);

        // Limit modifiers (\displaylimits, \limits, \nolimits) are resolved here.
        function resolveLimits(tokens) {
            for (var i = 0, l = tokens.length; i < l; i++) {
                if (tokens[i].type == 'limit modifier') {
                    if (tokens[i - 1] && tokens[i - 1].type == 'atom' && tokens[i - 1].atomType == 1) {
                        tokens[i - 1].limits = tokens[i].value;
                        tokens.splice(i, 1);
                        l = tokens.length;
                        i--;
                    } else {
                        var toks = (tokens[i].token.type == 'command' ? tokens[i].token.escapeChar + tokens[i].token.name : tokens[i].token.char).split('').map(function(element) {
                            return {
                                type: 'atom',
                                atomType: 0,
                                nucleus: {
                                    type: 'symbol',
                                    char: element,
                                    code: element.charCodeAt(0),
                                    invalid: true
                                },
                                superscript: null,
                                subscript: null
                            };
                        });
                        tokens[i] = {
                            type: 'atom',
                            atomType: 0,
                            nucleus: toks,
                            superscript: null,
                            subscript: null
                        };
                    }
                } else if (tokens[i].type == 'fraction') {
                    resolveLimits(tokens[i].numerator);
                    resolveLimits(tokens[i].denominator);
                } else if (tokens[i].type == 'table') {
                    for (var i = 0, l = tokens[i].cellData.length; i < l; i++) {
                        for (var n = 0, j = tokens[i].cellData[i].length; n < j; n++) {
                            resolveLimits(tokens[i][n].content);
                        }
                    }
                } else if (tokens[i].type == 'atom') {
                    if (tokens[i].atomType == 1) tokens[i].limits = 'display';
                    if (Array.isArray(tokens[i].nucleus)) resolveLimits(tokens[i].nucleus);
                    if (Array.isArray(tokens[i].superscript)) resolveLimits(tokens[i].superscript);
                    if (Array.isArray(tokens[i].subscript)) resolveLimits(tokens[i].subscript);
                } else if (tokens[i].type == 'mathchoice') {
                    resolveLimits(tokens[i].groups);
                }
            }
        }
        resolveLimits(scopes[0].tokens);

        // Any \hbox and \vbox commands need to take affect now. If there was a \hbox or
        // \vbox, the token after it will be placed inside a box with the specified height
        // or width
        function resolveBoxes(tokens) {
            for (var i = 0, l = tokens.length; i < l; i++) {
                if (tokens[i].type == 'box wrapper') {
                    if (tokens[i + 1] && tokens[i + 1].type == 'atom') {
                        tokens.splice(i, 2, {
                            type: 'box',
                            boxType: tokens[i].value,
                            to: tokens[i].to,
                            spread: tokens[i].spread,
                            content: tokens[i + 1],
                            superscript: tokens[i + 1].superscript,
                            subscript: tokens[i + 1].subscript
                        });
                        tokens[i].content.superscript = null;
                        tokens[i].content.subscript = null;
                        l = tokens.length;
                        i--;
                    } else {
                        var toks = (tokens[i].token.type == 'command' ? tokens[i].token.escapeChar + tokens[i].token.name : tokens[i].token.char).split('').map(function(element) {
                            return {
                                type: 'atom',
                                atomType: 0,
                                nucleus: {
                                    type: 'symbol',
                                    char: element,
                                    code: element.charCodeAt(0),
                                    invalid: true
                                },
                                superscript: null,
                                subscript: null
                            };
                        });
                        tokens[i] = {
                            type: 'atom',
                            atomType: 0,
                            nucleus: toks,
                            superscript: null,
                            subscript: null
                        };
                    }
                } else if (tokens[i].type == 'fraction') {
                    resolveFamilies(tokens[i].numerator);
                    resolveFamilies(tokens[i].denominator);
                } else if (tokens[i].type == 'table') {
                    for (var i = 0, l = tokens[i].cellData.length; i < l; i++) {
                        for (var n = 0, j = tokens[i].cellData[i].length; n < j; n++) {
                            resolveFamilies(tokens[i][n].content);
                        }
                    }
                } else if (tokens[i].type == 'atom') {
                    if (Array.isArray(tokens[i].nucleus)) resolveFamilies(tokens[i].nucleus);
                    if (Array.isArray(tokens[i].superscript)) resolveFamilies(tokens[i].superscript);
                    if (Array.isArray(tokens[i].subscript)) resolveFamilies(tokens[i].subscript);
                } else if (tokens[i].type == 'mathchoice') {
                    resolveBoxes(tokens[i].groups);
                }
            }
        }
        resolveBoxes(scopes[0].tokens);

        mouth.finalize();

        // Passing in a third, truthy argument will return the outer scope instead of the
        // tokens that were parsed.
        if (arguments.length > 2 && arguments[2]) {
            return scopes[0];
        }

        return [scopes[0].tokens, string, true];
    }


    // This function works the same as `_tokenize' except all the definitions made in-
    // side it will be made \global. It's almost like setting \globaldefs to 1 except
    // that definitions inside closed scopes won't be affected. Setting \globadefs to
    // 1 effectively makes all `\def's to `\gdef'. This function will only set the
    // `\def's on the outer scope to `\gdef'. A `style' argument is passed here since
    // no tokens are being returned and thus the style doesn't matter. TeXstring should
    // NOT be followed up by math shift characters. The whole string should be 100% TeX
    // that would be able to parse between two math shift tokens.
    fontTeX._tokenize.global = function global(TeXstring) {
        var scope = fontTeX._tokenize(TeXstring + '$', 'inline', true);

        data.defs.macros = {};
        data.defs.active = {};
        data.registers.count = {};
        data.registers.dimen = {};
        data.registers.skip = {};
        data.registers.muskip = {};
        data.registers.named = {};
        for (var key in scope.defs.macros) data.defs.macros[key] = scope.defs.macros[key];
        for (var key in scope.defs.active) data.defs.active[key] = scope.defs.active[key];
        var doneRegs = [];
        for (var key in scope.registers.count) data.registers.count[key] = new IntegerReg(scope.registers.count[key].value);
        for (var key in scope.registers.dimen) data.registers.dimen[key] = new DimenReg(scope.registers.dimen[key].sp.value, scope.registers.dimen[key].em.value);
        for (var key in scope.registers.skip) {
            data.registers.skip[key] = new GlueReg();
            data.registers.skip[key].start.sp.value = scope.registers.skip[key].start.sp.value;
            data.registers.skip[key].start.em.value = scope.registers.skip[key].start.em.value;
            if (scope.registers.skip[key].stretch.type == 'infinite dimension') data.registers.skip[key].stretch = new InfDimen(scope.registers.skip[key].stretch.number.value, scope.registers.skip[key].stretch.magnitude.value);
            else data.registers.skip[key].stretch = new DimenReg(scope.registers.skip[key].stretch.sp.value, scope.registers.skip[key].stretch.em.value);
            if (scope.registers.skip[key].shrink.type == 'infinite dimension') data.registers.skip[key].shrink = new InfDimen(scope.registers.skip[key].shrink.number.value, scope.registers.skip[key].shrink.magnitude.value);
            else data.registers.skip[key].shrink = new DimenReg(scope.registers.skip[key].shrink.sp.value, scope.registers.skip[key].shrink.em.value);
        }
        for (var key in scope.registers.muskip) {
            data.registers.muskip[key] = new MuGlueReg();
            data.registers.muskip[key].start.mu.value = scope.registers.muskip[key].start.mu.value;
            if (scope.registers.muskip[key].stretch.type == 'infinite dimension') data.registers.muskip[key].stretch = new InfDimen(scope.registers.muskip[key].stretch.number.value, scope.registers.muskip[key].stretch.magnitude.value);
            else data.registers.muskip[key].stretch = new MuDimenReg(scope.registers.muskip[key].stretch.mu.value);
            if (scope.registers.muskip[key].shrink.type == 'infinite dimension') data.registers.muskip[key].shrink = new InfDimen(scope.registers.muskip[key].shrink.number.value, scope.registers.muskip[key].shrink.magnitude.value);
            else data.registers.muskip[key].shrink = new MuDimenReg(scope.registers.muskip[key].shrink.mu.value);
        }
        for (var key in scope.registers.named) {
            if (doneRegs.includes(scope.registers.named[key])) {
                data.registers.named[key] = scope.registers.named[key];
                continue;
            }
            if (scope.registers.named[key].type == 'integer') {
                data.registers.named[key] = new IntegerReg(scope.registers.named[key].value);
            } else if (scope.registers.named[key].type == 'dimension') {
                data.registers.named[key] = new DimenReg(scope.registers.named[key].sp.value, scope.registers.named[key].em.value);
            } else if (scope.registers.named[key].type == 'mu dimension') {
                data.registers.named[key] = new MuDimenReg(scope.registers.named[key].mu.value);
            } else if (scope.registers.named[key].type == 'glue') {
                data.registers.named[key] = new GlueReg();
                data.registers.named[key].start.sp.value = scope.registers.named[key].start.sp.value;
                data.registers.named[key].start.em.value = scope.registers.named[key].start.em.value;
                if (scope.registers.named[key].stretch.type == 'infinite dimension') data.registers.named[key].stretch = new InfDimen(scope.registers.named[key].stretch.number.value, scope.registers.named[key].stretch.magnitude.value);
                else data.registers.named[key].stretch = new DimenReg(scope.registers.named[key].stretch.sp.value, scope.registers.named[key].stretch.em.value);
                if (scope.registers.named[key].shrink.type == 'infinite dimension') data.registers.named[key].shrink = new InfDimen(scope.registers.named[key].shrink.number.value, scope.registers.named[key].shrink.magnitude.value);
                else data.registers.named[key].shrink = new DimenReg(scope.registers.named[key].shrink.sp.value, scope.registers.named[key].shrink.em.value);
            } else if (scope.registers.named[key].type == 'mu glue') {
                data.registers.named[key] = new MuGlueReg();
                data.registers.named[key].start.mu.value = scope.registers.named[key].start.mu.value;
                if (scope.registers.named[key].stretch.type == 'infinite dimension') data.registers.named[key].stretch = new InfDimen(scope.registers.named[key].stretch.number.value, scope.registers.named[key].stretch.magnitude.value);
                else data.registers.named[key].stretch = new MuDimenReg(scope.registers.named[key].stretch.mu.value);
                if (scope.registers.named[key].shrink.type == 'infinite dimension') data.registers.named[key].shrink = new InfDimen(scope.registers.named[key].shrink.number.value, scope.registers.named[key].shrink.magnitude.value);
                else data.registers.named[key].shrink = new MuDimenReg(scope.registers.named[key].shrink.mu.value);
            }
        }
        for (var key in scope.cats) data.cats[key].value = scope.cats[key].value;
        for (var key in scope.uc) data.uc[key].value = scope.uc[key].value;
        for (var key in scope.lc) data.lc[key].value = scope.lc[key].value;
    }


    // This function takes a list of tokens from `fontTeX._tokenize' and creates an
    // element with the TeX parsed. This is the top level function used to create a
    // complete fragment of elements.
    fontTeX._genHTML = function genHTML(container, tokens, contStyle, family) {
        // The full set of instructions as to how TeX creates a horizontal box from a list
        // of tokens starts on page 441 (all of Appendix G) of the TeXbook. This function
        // follows a similar set of instructions. Instead of horizontal boxes, actual HTML
        // elements are created instead.

        // Each list of tokens is parsed using the function below. The function is called
        // recursively for lists found within lists.

        // First, one central element is created that all other elements will be children
        // of. This is the element that gets returned.
        var div = document.createElement('div');
        // Its display style is also set to match whether it's an inline or a displayed e-
        // quation.
        if (contStyle == 'display') {
            div.style.textAlign = 'center';
        } else {
            div.style.display = 'inline-block';
        }

        // Do all the parsing now.
        newBox(tokens, contStyle, false, 'nm', div);


        // This function may be used inside `newBox'. It goes through an element, making
        // sure all its children don't allow wrapping.
        function noWrap(elem) {
            for (var i = 0, l = elem.children.length; i < l; i++) {
                noWrap(elem.children[i]);
            }
            if (elem.style.flexWrap) elem.style.flexWrap = 'nowrap';
            return elem;
        }

        // The function creates a <div> with display: flex (or flex-inline for inline equa-
        // tions). That's to allow for grow-able space so that the items within the box
        // will be spread apart such that the items will take up the full width of the
        // line. Within the encompassing flex box, parts of the equation will be rendered
        // in a sub flex box. Each Rel and Bin atom marks the end of a sub flex box and the
        // start of a new one. It basically lets the line be split only after Rel and Bin
        // atoms (after symbols like "=" or "+").
        function newBox(tokens, style, cramped, font, parent) {

            // If the tokens are empty (like when a {} is encountered), nothing happens. An
            // empty div is placed just so `parent' can assume it has a child, but the div
            // won't actually have any content in it.
            if (!tokens.length) {
                var empty = document.createElement('div');
                empty.style.display = 'inline-flex';
                empty.displayedStyle = style;
                empty.crampedStyle = cramped;
                parent.appendChild(empty);
                return;
            }

            // When a new box is made, the last character from the last parsed atom is returned
            // to give italic corrections a character to affect.
            var lastChar = null;

            // This is the parent flex-box. It's allowed to wrap its child elements.
            var flex = document.createElement('div');
            flex.style.display = 'inline-flex';
            flex.style.flexWrap = 'wrap';
            flex.style.alignItems = 'baseline';
            flex.displayedStyle = style;
            flex.crampedStyle = cramped;
            flex.style.justifyContent = contStyle == 'display' ? 'center' : 'initial';
            var childFlexes = [document.createElement('div')];
            Object.defineProperty(childFlexes, 'last', {
                get: function() {
                    return this[this.length - 1];
                }
            });
            childFlexes[0].style.display = 'inline-flex';
            childFlexes[0].style.flexWrap = 'nowrap';
            childFlexes[0].style.alignItems = 'baseline';

            // `items' holds all the elements that will be added to a sub element of `flex'.
            // `atoms' is similar except that only actual atom elements are added to its array.
            // It helps when trying to get the last atom without having to iterate over `items'
            // in reverse to get the last one.
            var items = [],
                atoms = [];

            // Vertical glues and kerns let text be offset by a dimension. After a vertical
            // glue/kern, all the text after it up to the end of the current box needs to
            // be shifted up with it. To keep track of dimensions, they are added to the array
            // below. Vertical glues are treated exactly vertical kerns in all cases (horizon-
            // tal glues can sometimes stretch, so they aren't EXACTLY like kerns). To make
            // them stretchable would require setting everything inside even more layer of flex
            // boxes and pretty much changing how everything is rendered.
            var verticalOffsets = {sp: 0, em: 0};

            for (var i = 0, l = tokens.length; i < l; i++) {
                var arr = parse1(1, i, l);
                if (arr) {
                    i = arr[0];
                    l = arr[1];
                }
            }

            // Now that atoms have been parsed and turned into HTML, they need to be placed
            // into their parents. This is the step where glues and kerns are handled as well.
            // Before that though, the last atom needs to be checked. If it's a Bin atom, it
            // has to be turned into an Ord atom.
            if (atoms.length && atoms[atoms.length - 1].atomType == 2) atoms[atoms.length - 1].atomType = 0;

            for (var i = 0, l = items.length; i < l; i++) {
                var arr = parse2(1, i, l);
                if (arr) {
                    i = arr[0];
                    l = arr[1];
                }
            }

            // This is where everything is actually parsed. It takes a `step' argument, which
            // tells it what to try to do. For example, step 1 corresponds to parsing glues and
            // kerns. If the current token isn't a glue or kern, `step' is incremented to 2 and
            // then step 2 will be tried. In some cases, even if one step is executed, it may
            // still refer to another step that has to do something else on the current item.
            // Steps here don't necessarily correspond to the steps in the TeXbook because the
            // types of items here don't exactly correspond to the types of items in TeX. For
            // example, this version doesn't have penalties, so that skip is stepped. This
            // version does have tables however, which TeX doesn't count here, so another step
            // is added here.

            // Each list is iterated over twice. `parse1` is the set of steps for the first
            // iteration. It's where each atom is turned into HTML. `parse2' is responsible
            // for setting those atoms and glues/kerns into their parents.
            function parse1(step, i, l) {
                var token = tokens[i],
                    next = tokens[i + 1] || {},
                    previous = tokens[i - 1] || {};
                switch (step) {
                    case 1:
                    default:
                        // The first step only applies to glues and kerns. If the token isn't either of
                        // those, go to the next step.
                        if (token.type != 'glue' && token.type != 'kern' && token.type != 'vglue' && token.type != 'vkern') return parse1(2, i, l);

                        if (token.italicCorrection) token.italicCorrection = lastChar || '';

                        // If a \nonscript glue is found, and the style is script or scriptscript, the
                        // immediately following glue or kern is removed. Otherwise, if the glue or kern is
                        // in terms of mu units, they are converted to em units by dividing by 18 (18mu =
                        // 1em).
                        if (token.type == 'glue' && token.isNonScript) {
                            if ((style == 'script' || style == 'scriptscript') && (next.type == 'glue' || next.type == 'vglue' || next.type == 'kern' || next.type == 'vkern')) {
                                tokens.splice(i + 1, 1);
                                l--;
                            }
                            return [i,l];
                        } else if (token.type == 'glue' && token.glue.type == 'mu glue') {
                            token.glue = new GlueReg(new DimenReg(0, token.glue.start.mu.value / 18),
                                token.glue.stretch.type == 'infinite dimension' ? token.glue.stretch : new DimenReg(0, ~~(token.glue.stretch.mu.value / 18)),
                                token.glue.shrink.type == 'infinite dimension' ? token.glue.shrink : new DimenReg(0, ~~(token.glue.shrink.mu.value / 18)));
                        } else if (token.type == 'kern' && token.dimen.type == 'mu dimension') {
                            token.dimen = new DimenReg(0, ~~(token.dimen.mu.value / 18));
                        }
                        items.push(token);
                        break;

                    case 2:
                        // This step checks for tokens like \displaystyle that change the style of the
                        // current font.
                        if (token.type == 'font modifier') {
                            if (['displaystyle', 'textstyle', 'scriptstyle', 'scriptscriptstyle'].includes(token.value)) style = token.value.substring(0, token.value.length - 5);
                            else font = token.value;
                            tokens.splice(i, 1);
                            i--;
                            l--;
                            return [i,l];
                        } else return parse1(3, i, l);
                        break;

                    case 3:
                        // This step checks if the token is a list from \mathchoice. If it is, the list for
                        // the current style will be chosen (the other 3 will be discarded) and put into
                        // token list.
                        if (token.type == 'mathchoice') {
                            var atom = token.groups[({
                                display: 0,
                                text: 1,
                                script: 2,
                                scriptscript: 3
                            })[style]];
                            tokens.splice(i, 1, atom);
                            i--;
                            return [i,l];
                        } else return parse1(4, i, l);
                        break;

                    case 4:
                        // This step checks if the token is a Bin atom and that a Bin atom is actually al-
                        // lowed in the current context (i.e. a Bin atom can't follow Bin, Op, Rel, Open,
                        // Punct, or the beginning of the list).
                        if (token.type == 'atom' && token.atomType == 2) {
                            if (!atoms[0] || [1, 2, 3, 4, 6].includes(atoms[atoms.length - 1].atomType)) token.atomType = 0;
                            return parse1(10, i, l);
                        } else return parse1(5, i, l);
                        break;

                    case 5:
                        // This step works like the previous one except it works the other way around: if
                        // the current atom is Rel, Close, or Punct, and the previous atom was a Bin atom,
                        // the last atom is changed into an Ord.
                        if (token.type == 'atom' && atoms.length && (token.atomType == 3 || token.atomType == 5 || token.atomType == 6)) {
                            if (atoms[0] && atoms[atoms.length - 1].atomType == 2) atoms[atoms.length - 1].atomType = 0
                            return parse1(10, i, l);
                        } else return parse1(6, i, l);
                        break;

                    case 6:
                        // If the current atom is an Open or Inner atom, it should go directly to another
                        // step.
                        if (token.type == 'atom' && [4, 'inner', 'over', 'under', 'vcenter', 'rad', 'acc'].includes(token.atomType)) {
                            return parse1(10, i, l);
                        } else return parse1(7, i, l);
                        break;

                    case 7:
                        // Op atoms' limits are evaluated before being rendered like other atoms.
                        if (token.type == 'atom' && token.atomType == 1) {
                            if (token.limits == 'display') token.limits = style == 'display';
                            return parse1(10, i, l);
                        } else return parse1(8, i, l);
                        break;

                    case 8:
                        // This checks if the token is a fraction item. In plain TeX, there's a bunch of
                        // math that goes into creating fractions so that the numerator and denominator
                        // look properly placed. It relies on a lot of font parameters, which are only a-
                        // vailable from METAFONT's fonts. HTML fonts on the other hand, don't have any
                        // parameters (some of them are figured out by `fontTeX.fontDimen', but some just
                        // need to be known explicitly). Instead of going through all the math and guessing
                        // at font parameters, the numerator and denominator are placed pretty much right
                        // on top of the fraction bar. It seems to work, so not really a problem there.
                        if (token.type == 'fraction' && token) {
                            // Even though the current token is already the nucleus of an atom, it still needs
                            // to be recognized as its own atom in `parse2'. That's why an `atomWrapper' is
                            // made for the fraction. It'll be added as an atom inside its own box which will
                            // then become the nucleus of the outer atom.
                            var atomWrapper = {
                                type: 'atom',
                                atomType: 'inner',
                                nucleus: null,
                                superscript: null,
                                subscript: null,
                                style: style,
                                div: document.createElement('div')
                            }
                            items.push(atomWrapper);
                            atoms.push(atomWrapper);
                            token.style = style;
                            token.div = atomWrapper.div;
                            token.div.style.display = 'inline-block';
                            token.div.style.whiteSpace = 'nowrap';

                            // A fraction's bar is always supposed to be centered on the line, even if the num-
                            // erator is five times as tall as the denominator. The center that's used here
                            // is 0.5em higher than the bottom of the font's bottom line. To get that, we take
                            // away the baseline height (`fontTeX.fontDimen.baselineHeightOf') from 0.5.

                            var numer = document.createElement('div'),
                                denom = document.createElement('div');
                            numer.style.display = denom.style.display = 'inline-block';
                            numer.style.verticalAlign = 'text-bottom';
                            numer.style.position = 'relative';
                            denom.style.verticalAlign = 'text-bottom';
                            denom.style.position = 'relative'

                            newBox(token.numerator, style == 'display' ? 'text' : style == 'text' ? 'script' : 'scriptscript', cramped, font, numer);
                            newBox(token.denominator, style == 'display' ? 'text' : style == 'text' ? 'script' : 'scriptscript', true, font, denom);

                            // This is where the fraction bar's width goes from a `DimenReg' to a CSS width
                            // string. A fraction bar from \over is chosen based on the font. Em units for the
                            // fraction bar are scaled down if the numerator and denominator are being scaled
                            // down. In \displaystyle and \scripscriptstyle, the numerator and denominator re-
                            // main the same size, so no scaling is needed. The other styles though get their
                            // fraction parts scaled down, so it would only make sense that the bar gets scaled
                            // down too (since em units are relative to the font). Absolute units like pts stay
                            // the same.
                            var barWidthDimen = token.barWidth == 'from font' ? new DimenReg(0, fontTeX.fontDimen.visibleWidthOf('|', family) * 65536) : token.barWidth,
                                unscaledBarWidth = barWidthDimen.sp.value ?
                                    barWidthDimen.em.value ? 'calc(' + barWidthDimen.em.value / 65536 + 'em + ' + barWidthDimen.sp.value / 65536 + 'pt)' :
                                    barWidthDimen.sp.value / 65536 + 'pt' : barWidthDimen.em.value / 65536 + 'em';
                            if (style == 'text' || style == 'script') barWidthDimen.em.value *= .707106781;
                            var barWidth = barWidthDimen.sp.value ?
                                barWidthDimen.em.value ? 'calc(' + barWidthDimen.em.value / 65536 + 'em + ' + barWidthDimen.sp.value / 65536 + 'pt)' :
                                barWidthDimen.sp.value / 65536 + 'pt' : barWidthDimen.em.value / 65536 + 'em';

                            // This code snippet takes measurements of the numerator and denominator for pos-
                            // itioning and for calculating height and depth. Since the bar's width may be de-
                            // pendent on the font size (it can have em units), simply setting everything to
                            // font size 10px and dividing by 10 doesn't work. Instead, they are measured at
                            // the font size they will end up being displayed as.
                            var emRef = document.createElement('div');
                            emRef.style.height = '1em';
                            container.appendChild(emRef);
                            var emPx = emRef.getBoundingClientRect().height;
                            emRef.style.height = barWidth;
                            emRef.style.fontSize = style == 'script' || style == 'scriptscript' ? '.707106781em' : '1em';
                            var finalBarWidth = emRef.getBoundingClientRect().height;
                            emRef.style.height = '1em';
                            finalBarWidth /= emRef.getBoundingClientRect().height;
                            container.removeChild(emRef);
                            container.appendChild(numer);
                            var numerDimens = numer.getBoundingClientRect(),
                                numerWidth = numer.getBoundingClientRect().width;
                            numer.renderedHeight = numerDimens.height / emPx * (style == 'text' || style == 'script' ? .707106781 : 1);
                            container.removeChild(numer);
                            container.appendChild(denom);
                            var denomDimens = denom.getBoundingClientRect(),
                                denomHeight = denomDimens.height / emPx,
                                denomWidth = denomDimens.width;
                            denom.renderedHeight = denomHeight * (style == 'text' || style == 'script' ? .707106781 : 1);
                            container.removeChild(denom);

                            // Measurements have been gotten. Now add some style for the numerator and denomin-
                            // ator.
                            if (style == 'text' || style == 'script') {
                                numer.style.fontSize = denom.style.fontSize = '.707106781em';
                                numer.style.paddingTop = 'calc(.707106781em + ' + unscaledBarWidth + ' / 2)';
                                numer.style.top = 'calc(-.707106781em - ' + unscaledBarWidth + ' / 2)';
                                denom.style.top = 'calc(' + (denomHeight - .707106781) + 'em + ' + unscaledBarWidth + '/ 2)';
                                token.div.style.paddingBottom = 'calc(' + (denom.renderedHeight - .5) + 'em + ' + barWidth + ' / 2)'
                            } else {
                                numer.style.fontSize = denom.style.fontSize = '';
                                numer.style.paddingTop = 'calc(.5em + ' + barWidth + ' / 2)';
                                numer.style.top = 'calc(-.5em - ' + barWidth + ' / 2)';
                                denom.style.top = 'calc(' + (denomHeight - .5) + 'em + ' + barWidth + '/ 2)';
                                token.div.style.paddingBottom = 'calc(' + (denomHeight - .5) + 'em + ' + barWidth + ' / 2)'
                            }

                            var thinner = numerWidth > denomWidth ? denom : numer,
                                thicker = numerWidth > denomWidth ? numer : denom;

                            // First, the bar needs to be added. There are three elements for the bar. The
                            // first, outer element has no height or width so that it won't interfere with
                            // any other elements; the bar is purely for display. The numerator and denomina-
                            // tor elements are what offset everything. The outer element then has another
                            // element inside it. That's where the displayed part comes. It is positioned in
                            // the middle of the line with no height. It has a border-top with the width of
                            // the bar and its background color set to the color of its parents (so that it
                            // takes the same color as the text instead of the background). Within that elem-
                            // ent is another. Its only purpose is to give the bar its width. The thicker of
                            // the numerator and denominator is copied and placed inside the third element.
                            // It'll grow and inherit the width of the whole fraction, giving its parent (the
                            // one with the border-top) the same width so that the whole bar will stretch to
                            // fill the entire fraction.
                            var barCont = document.createElement('div'),
                                bar = document.createElement('div'),
                                widthCont = document.createElement('div');

                            barCont.style.display = 'inline-block';
                            barCont.style.position = 'relative';
                            barCont.style.verticalAlign = 'text-bottom';
                            barCont.style.top = '-.5em';
                            barCont.style.width = '.1em';
                            barCont.style.height = 0;
                            bar.style.borderTop = barWidth + ' solid currentColor';
                            bar.style.padding = '0 .1em';
                            bar.style.position = 'relative';
                            bar.style.top = 'calc(' + barWidth + ' / -2)';
                            bar.style.display = 'inline-block';
                            bar.style.height = 0;
                            widthCont.style.display = 'inline-block';
                            widthCont.style.opacity = 0;
                            barCont.style.webkitUserSelect =
                                barCont.style.mozUserSelect =
                                barCont.style.msUserSelect =
                                barCont.style.userSelect = 'none';
                            barCont.style.pointerEvents = 'none';
                            widthCont.appendChild(noWrap(thicker.cloneNode(true)));
                            bar.appendChild(widthCont);
                            barCont.appendChild(bar);
                            token.div.appendChild(barCont);

                            // K, so big comment here just to explain what's happening in the next snippet of
                            // code and why I did it the way I did. If you don't care why it works, just skip
                            // this. It's mostly for me anyway if I ever come back to it and need to know
                            // what's going on.
                            //
                            // Now that the bar has been added, the numerator and denominator need to be added
                            // one on top of the other. They;re placed the same way stacked sub/superscripts
                            // are placed. (If you don't know how those are placed, go to case: 10 of this
                            // whole `switch'. That's where atoms' nuclei and scripts are created.) The only
                            // difference here is that the thinner part of the fraction needs to be centered
                            // (which actually takes more work than you'd think). Fractions are special from
                            // other things in that the thinner of the numerator/denominator parts SHOULD re-
                            // spect glues. Outside of a fraction, a glue acts just like a kern since it can't
                            // really be stretched. In a fraction though, since both parts have a defined width
                            // that won't change because of a line wrap, glues should be able to alter the pos-
                            // itioning of parts in a fraction. The thicker part of a fraction doesn't have any
                            // extra space, so glues don't really matter there. In the thinner part, there will
                            // (probably) be extra space that glues should stretch to fill up. To allow for
                            // that AND to make it the text in a part centered by default, there needs to be a
                            // lot of elements and workarounds. Basically, the thicker part of a fraction is
                            // set just like normal without any messing around with it. The thinner part though
                            // is what gets changed. For the rest of this example, the numeration (`numer') is
                            // assumed to be the thinner of the two (i.e. `thinner' == `numer'). `numer' is a
                            // <div> with a single flex box <div> child. That flex box needs to be stretched
                            // to be the same width as `denom'. That way, all its parts and glues will be
                            // stretched as well (the glues will actually act like glues instead of kerns).
                            // First, `numer' needs to be stretched to match the width of `denom'. A container
                            // element is made. Inside that container, a (hidden) clone of `denom' is placed so
                            // that the container will adopt its width. Now, we need to get the original flex
                            // box child from before in there so that it can also inherit the same width. But
                            // just adding it directly will affect the width of the containing element, so we
                            // need to add it such that it won't add on any extra width (but we can't set its
                            // CSS width property to 0 because it ALSO needs the width of the container). To
                            // get around that, another container element is made. Its position is set to abso-
                            // lute so that it won't add any width to the parent. Setting its width to 100%
                            // doesn't work though because its absolutely positioned. Instead, both its left
                            // and right properties are set to 0, which allows it to stretch to the full width
                            // of the parent containing element (even though its the full width, it doesn't
                            // add any extra width to the parent because its absolutely positioned). NOW, the
                            // flex box is set inside there with width: 100% so that it now has the full width
                            // of the overall fraction. Glues can now stretch. But height is still a problem.
                            // Since the flex box is inside a position: absolute element, its height doesn't
                            // affect the fraction now. We get around this the same way as the width: we make a
                            // clone of the flex box and we add it inside another element with width: 0. That
                            // element now has the correct height of the numerator of the fraction and no
                            // width, so it won't affect the overall containing element's width. That's added
                            // alongside the position: absolute element. Now, finally, the containing element
                            // has the correct height, width, and a stretched version of `numer'. It can now
                            // be added to the fraction. It's placed inside the original `numer' element (which
                            // has a width of 0 so as not to offset `denom' when they're placed). The last
                            // thing is just to center the flex box by default so that `numer' appears in the
                            // middle of the fraction, not the left. To do that, two artificial glue items are
                            // added to the display flex box: one before and one after. Now, even if there are
                            // no glues present, the `numer' will still be rendered in the middle of the frac-
                            // tion because the two glues will fill and center it. Most of the extra styling
                            // stuff below is to make sure things appear properly vertically.

                            var thinContainer = document.createElement('div'),
                                cloneContainer = document.createElement('div'),
                                flexContainer = document.createElement('div'),
                                heightContainer = document.createElement('div'),
                                flexChild = thinner.firstElementChild,
                                clone1 = noWrap(thicker.cloneNode(true)),
                                clone2 = noWrap(thinner.cloneNode(true)),
                                startGrower = document.createElement('div'),
                                endGrower = document.createElement('div');
                            clone1.style.fontSize = clone2.style.fontSize = '';
                            clone2.style.paddingTop = 0;
                            clone2.style.margin = 0;
                            clone2.style.border = 0;
                            clone2.style.padding = 0;
                            if (flexChild) {
                                flexChild.style.width = '100%';
                                flexChild.insertBefore(startGrower, flexChild.firstElementChild);
                                flexChild.appendChild(endGrower);
                                flexContainer.appendChild(flexChild);
                            }
                            thinContainer.style.position = 'relative';
                            cloneContainer.style.height = 0;
                            cloneContainer.style.verticalAlign = 'middle';
                            cloneContainer.style.display = 'inline-block';
                            cloneContainer.style.opacity = 0;
                            cloneContainer.style.webkitUserSelect =
                                cloneContainer.style.mozUserSelect =
                                cloneContainer.style.msUserSelect =
                                cloneContainer.style.userSelect =
                                heightContainer.style.webkitUserSelect =
                                heightContainer.style.mozUserSelect =
                                heightContainer.style.msUserSelect =
                                heightContainer.style.userSelect = 'none';
                            cloneContainer.style.pointerEvents = 'none';
                            thinContainer.style.display = 'inline-block';
                            heightContainer.style.display = 'inline-block';
                            heightContainer.style.width = 0;
                            heightContainer.style.pointerEvents = 'none';
                            heightContainer.style.opacity = 0;
                            flexContainer.style.position = 'absolute';
                            startGrower.style.flexGrow = endGrower.style.flexGrow = startGrower.style.flexShrink = endGrower.style.flexShrink = 1;
                            thinner.style.width = flexContainer.style.left = flexContainer.style.right = flexContainer.style.top = 0;
                            heightContainer.appendChild(clone2);
                            thinContainer.appendChild(heightContainer);
                            thinContainer.appendChild(flexContainer);
                            cloneContainer.appendChild(clone1);
                            thinContainer.appendChild(cloneContainer);
                            thinner.appendChild(thinContainer);
                            token.div.appendChild(thinner);
                            token.div.appendChild(thicker);

                            // Since the fraction bar goes out an extra .1em past its numerator and denomina-
                            // tor parts, an extra width: .1em element needs to be added after the fraction to
                            // offset anything that comes after it.
                            var widthOffset = document.createElement('div');
                            widthOffset.style.display = 'inline-block';
                            widthOffset.style.width = '.1em';
                            token.div.appendChild(widthOffset);


                            // Fractions are allowed to have delimiters like \left and \right. The only real
                            // difference is that fractions' delimiters have a height dependent on the current
                            // style, not the height of the encompassed fraction.

                            // Atom delimiters are handled in case 10. That's where this code was copied from
                            // and where comments are that explain what's happening.
                            var leftDelim = document.createElement('canvas'),
                                rightDelim = document.createElement('canvas'),
                                setHeight = style == 'display' ? 2.416666666 : style == 'text' ? 1.416666666 : 0;

                            leftDelim.style.display = rightDelim.style.display = 'inline-block';

                            if (token.delims[0] == '>') token.delims[0] = '⟩';
                            if (token.delims[1] == '>') token.delims[1] = '⟩';
                            if (token.delims[0] == '<') token.delims[0] = '⟨';
                            if (token.delims[1] == '<') token.delims[1] = '⟨';

                            function renderElem(elem, delimiter, leftSide) {
                                switch (delimiter) {
                                    case '.':
                                    default:
                                        items.splice(items.length - (leftSide ? 1 : 0), 0, {
                                            type: 'kern',
                                            dimen: token.nullDelimiterSpace
                                        });
                                        break;

                                    case '|':
                                    case '/':
                                    case '\\':
                                    case '‖':
                                    case '⎪':
                                    case '⏐':
                                    case '⟨':
                                    case '⟩':
                                        var height = Math.max(setHeight, fontTeX.fontDimen.heightOf(delimiter, family) + fontTeX.fontDimen.depthOf(delimiter, family));
                                        elem.style.height = height + 'em';
                                        elem.style.width = fontTeX.fontDimen.widthOf(delimiter, family) + 'em';
                                        elem.style.verticalAlign = 'middle';

                                        elem.height = 100;
                                        elem.width = fontTeX.fontDimen.widthOf(delimiter, family) / (fontTeX.fontDimen.heightOf(delimiter, family) + fontTeX.fontDimen.depthOf(delimiter, family)) * 100;
                                        var context = elem.getContext('2d');
                                        context.textAlign = 'center';
                                        // The font is set to the current family with a font-size that will draw the char-
                                        // acter such that its height + depth will take up 100px (the entirety of the can-
                                        // vas).
                                        context.font = 100 / (fontTeX.fontDimen.heightOf(delimiter, family) + fontTeX.fontDimen.depthOf(delimiter, family)) + 'px ' + family;
                                        // Now the character is drawn. The x coordinate is set in the middle of the canvas
                                        // to ensure the character is drawn right in the center, like a normal character
                                        // would outside of a canvas. The y coordinate though is offset by the character's
                                        // depth so that the bottom of the visible character will be at the bottom of the
                                        // canvas (if it was just 100, everything below the character's baseline would be
                                        // cropped off).
                                        context.fillText(delimiter, elem.width / 2, 100 - fontTeX.fontDimen.depthOf(delimiter, family) * 100 / (fontTeX.fontDimen.heightOf(delimiter, family) + fontTeX.fontDimen.depthOf(delimiter, family)));
                                        // Now the canvas is inserted into the element.
                                        token.div.insertBefore(elem, leftSide ? token.div.firstElementChild : null);
                                        break;

                                    case '(':
                                    case ')':
                                        // This block accounts for parentheses. Parentheses can't just be stretched to any
                                        // amount like the previous block because then they just start to look like really
                                        // long "|". But parentheses CAN be stretched a little before they start looking
                                        // weird. This block will stretch a parenthesis to a maximum of two times its nor-
                                        // mal height. If the desired height is any bigger than that, then only the middle,
                                        // most vertical part of the parenthesis will stretch. This happens in normal TeX
                                        // too (it probably allows for stretching past two times, but then again it has
                                        // special characters for that; all we have here is the one).

                                        var height = Math.max(setHeight, fontTeX.fontDimen.heightOf(delimiter, family) + fontTeX.fontDimen.depthOf(delimiter, family));
                                        elem.style.height = height + 'em';
                                        elem.style.width = fontTeX.fontDimen.widthOf(delimiter, family) + 'em';
                                        elem.style.verticalAlign = 'middle';

                                        if (height <= 2) {
                                            // If the height is less than 2, the character can be drawn normally and then just
                                            // stretched. The code below is copied from the second case item.

                                            elem.height = 100;
                                            elem.width = fontTeX.fontDimen.widthOf(delimiter, family) / fontTeX.fontDimen.heightOf(delimiter, family) * 100 * (fontTeX.fontDimen.heightOf(delimiter, family) + fontTeX.fontDimen.depthOf(delimiter, family));
                                            var context = elem.getContext('2d');
                                            context.textAlign = 'center';
                                            context.font = 100 / (fontTeX.fontDimen.heightOf(delimiter, family) + fontTeX.fontDimen.depthOf(delimiter, family)) + 'px ' + family;
                                            context.translate(0, 100);
                                            context.fillText(delimiter, elem.width / 2, -fontTeX.fontDimen.depthOf(delimiter, family) * 100 / (fontTeX.fontDimen.heightOf(delimiter, family) + fontTeX.fontDimen.depthOf(delimiter, family)));
                                        } else {
                                            // If the desired height is greater than two times its normal height, extra steps
                                            // are necessary to get to its desired height without making it look weird.

                                            // To begin, two characters need to be drawn. One will be used for the bottom of
                                            // the parenthesis, the other for the top. We need to keep them separate though.
                                            // Consider an example where the height is only off by 1px. If we just draw both
                                            // character (one at the top of the canvas, the other at the bottom) and clear the
                                            // rectangle between their two halves, only one row of one pixel will actually be
                                            // cleared. That's a problem because the top character will also be visible in the
                                            // bottom character's space because they're too close together. To prevent that,
                                            // the bottom is drawn first (only the bottom half), copied in an `ImageData', then
                                            // deleted from the canvas. Then the top is drawn and cropped (so only the top half
                                            // remains). Now, since the bottom half of the canvas has been cleared, the copy of
                                            // the bottom half of the character can be pasted. Now, even though the two would
                                            // normally overlap, they don't because they were drawn separately.
                                            var glyphHeight = (fontTeX.fontDimen.heightOf(delimiter, family) + fontTeX.fontDimen.depthOf(delimiter, family));
                                            elem.height = height * 50;
                                            elem.width = fontTeX.fontDimen.widthOf(delimiter, family) / fontTeX.fontDimen.heightOf(delimiter, family) * 100 * (fontTeX.fontDimen.heightOf(delimiter, family) + fontTeX.fontDimen.depthOf(delimiter, family));
                                            var context = elem.getContext('2d');
                                            context.textAlign = 'center';
                                            context.font = 100 / glyphHeight + 'px ' + family;
                                            context.fillText(delimiter, elem.width / 2, 50 - fontTeX.fontDimen.depthOf(delimiter, family) * 100 / glyphHeight);
                                            // Now that the bottom half of the first glyph has been drawn, an `ImageData' saves
                                            // the pixels so they can be put on the canvas later.
                                            var bottomHalf = context.getImageData(0, 0, elem.width, 50);
                                            context.clearRect(0, 0, elem.width, elem.height);
                                            // The top half needs to be drawn now.
                                            context.fillText(delimiter, elem.width / 2, 100 - fontTeX.fontDimen.depthOf(delimiter, family) * 100 / glyphHeight)
                                            context.clearRect(0, 50, elem.width, elem.height);
                                            // Now paste the bottom half.
                                            context.putImageData(bottomHalf, 0, elem.height - 50);
                                            // All that's left to do is to connect them. To do that, a new `ImageData' instance
                                            // is made where we can manipulate individual pixels. It will have the height of
                                            // empty region of the canvas (the space between the two halves). For the top half
                                            // of the `ImageData', the bottommost pixel of the top half character is copied and
                                            // pasted over and over on top of each other, one row at a time. The same thing
                                            // happens for the bottom half. It looks really inefficient below because it liter-
                                            // ally sets every single RGBA channel of every single pixel of every single row.
                                            // Since an `ImageData's `data' attribute is readonly though, you can't make a new
                                            // array and replace it, you have to change each individual value.
                                            var region = context.createImageData(elem.width, elem.height - 100);
                                            var topHalfRow = context.getImageData(0, 49, elem.width, 1).data,
                                                bottomHalfRow = bottomHalf.data.slice(0, elem.width * 4);
                                            for (var i = 0, l = region.height / 2; i < l; i++) {
                                                for (var n = 0, j = elem.width; n < j; n++) {
                                                    region.data[i * elem.width * 4 + n * 4] = topHalfRow[n * 4];
                                                    region.data[i * elem.width * 4 + n * 4 + 1] = topHalfRow[n * 4 + 1];
                                                    region.data[i * elem.width * 4 + n * 4 + 2] = topHalfRow[n * 4 + 2];
                                                    region.data[i * elem.width * 4 + n * 4 + 3] = topHalfRow[n * 4 + 3];
                                                    region.data[~~(i + region.height / 2) * elem.width * 4 + n * 4] = bottomHalfRow[n * 4];
                                                    region.data[~~(i + region.height / 2) * elem.width * 4 + n * 4 + 1] = bottomHalfRow[n * 4 + 1];
                                                    region.data[~~(i + region.height / 2) * elem.width * 4 + n * 4 + 2] = bottomHalfRow[n * 4 + 2];
                                                    region.data[~~(i + region.height / 2) * elem.width * 4 + n * 4 + 3] = bottomHalfRow[n * 4 + 3];
                                                }
                                            }
                                            // The pixels have all been copied. After it gets pasted below, the two halves will
                                            // be connected.
                                            context.putImageData(region, 0, 50);
                                        }
                                        token.div.insertBefore(elem, leftSide ? token.div.firstElementChild : null);
                                        break;

                                    case '[':
                                    case ']':
                                    case '⟮':
                                    case '⟯':
                                    case '↑':
                                    case '↓':
                                    case '↕':
                                    case '⇑':
                                    case '⇓':
                                    case '⇕':
                                    case '⌈':
                                    case '⌉':
                                    case '⌊':
                                    case '⌋':
                                    case '⎰':
                                    case '⎱':
                                        // These characters expand at the middle similar to how the parentheses do. The
                                        // only difference is that they don't try to stretch to twice their height first.
                                        // The code below is coped from the third case item.

                                        var height = Math.max(setHeight, fontTeX.fontDimen.heightOf(delimiter, family) + fontTeX.fontDimen.depthOf(delimiter, family));
                                        elem.style.height = height + 'em';
                                        elem.style.width = fontTeX.fontDimen.widthOf(delimiter, family) + 'em';
                                        elem.style.verticalAlign = 'middle';
                                        var glyphHeight = 100 / (fontTeX.fontDimen.heightOf(delimiter, family) + fontTeX.fontDimen.depthOf(delimiter, family));
                                        elem.height = Math.max(height, 1) * 100;
                                        elem.width = fontTeX.fontDimen.widthOf(delimiter, family) / fontTeX.fontDimen.heightOf(delimiter, family) * 100 * (fontTeX.fontDimen.heightOf(delimiter, family) + fontTeX.fontDimen.depthOf(delimiter, family));
                                        var context = elem.getContext('2d');
                                        context.textAlign = 'center';
                                        context.font = glyphHeight + 'px ' + family;
                                        context.fillText(delimiter, elem.width / 2, 50 - fontTeX.fontDimen.depthOf(delimiter, family) * glyphHeight);

                                        var bottomHalf = context.getImageData(0, 0, elem.width, 50);
                                        context.clearRect(0, 0, elem.width, elem.height);

                                        context.fillText(delimiter, elem.width / 2, 100 - fontTeX.fontDimen.depthOf(delimiter, family) * glyphHeight)
                                        context.clearRect(0, 50, elem.width, elem.height);

                                        context.putImageData(bottomHalf, 0, elem.height - 50);

                                        if (elem.height > 100) {
                                            var region = context.createImageData(elem.width, elem.height - 100);
                                            var topHalfRow = context.getImageData(0, 49, elem.width, 1).data,
                                                bottomHalfRow = bottomHalf.data.slice(0, elem.width * 4);
                                            for (var i = 0, l = region.height / 2; i < l; i++) {
                                                for (var n = 0, j = elem.width; n < j; n++) {
                                                    region.data[i * elem.width * 4 + n * 4] = topHalfRow[n * 4];
                                                    region.data[i * elem.width * 4 + n * 4 + 1] = topHalfRow[n * 4 + 1];
                                                    region.data[i * elem.width * 4 + n * 4 + 2] = topHalfRow[n * 4 + 2];
                                                    region.data[i * elem.width * 4 + n * 4 + 3] = topHalfRow[n * 4 + 3];
                                                    region.data[~~(i + region.height / 2) * elem.width * 4 + n * 4] = bottomHalfRow[n * 4];
                                                    region.data[~~(i + region.height / 2) * elem.width * 4 + n * 4 + 1] = bottomHalfRow[n * 4 + 1];
                                                    region.data[~~(i + region.height / 2) * elem.width * 4 + n * 4 + 2] = bottomHalfRow[n * 4 + 2];
                                                    region.data[~~(i + region.height / 2) * elem.width * 4 + n * 4 + 3] = bottomHalfRow[n * 4 + 3];
                                                }
                                            }
                                            context.putImageData(region, 0, 50);
                                        }

                                        token.div.insertBefore(elem, leftSide ? token.div.firstElementChild : null);
                                        break;

                                    case '{':
                                    case '}':
                                        // Curly braces are expanded in two places compared to other delimiters: once at
                                        // one third quarter up and the other at two thirds (between the things sticking
                                        // out on the side). It works for most fonts, but it might still look kind of weird
                                        // for others. There's no way to know for sure where to cut up the character other
                                        // than looking at individual pixels and looking for where the character seems most
                                        // vertically flat, which seems like a long, unnecessary and hard task for some-
                                        // thing small like this. It still works for most cases.

                                        var height = Math.max(setHeight, fontTeX.fontDimen.heightOf(delimiter, family) + fontTeX.fontDimen.depthOf(delimiter, family));
                                        elem.style.height = height + 'em';
                                        elem.style.width = fontTeX.fontDimen.widthOf(delimiter, family) + 'em';
                                        elem.style.verticalAlign = 'middle';
                                        var glyphHeight = 100 / (fontTeX.fontDimen.heightOf(delimiter, family) + fontTeX.fontDimen.depthOf(delimiter, family));
                                        elem.height = Math.max(height, 1) * 100;
                                        elem.width = fontTeX.fontDimen.widthOf(delimiter, family) / fontTeX.fontDimen.heightOf(delimiter, family) * 100 * (fontTeX.fontDimen.heightOf(delimiter, family) + fontTeX.fontDimen.depthOf(delimiter, family));
                                        var context = elem.getContext('2d');
                                        context.textAlign = 'center';
                                        context.font = glyphHeight + 'px ' + family;

                                        // The bottom half is saved here.
                                        context.fillText(delimiter, elem.width / 2, 33 - fontTeX.fontDimen.depthOf(delimiter, family) * glyphHeight);
                                        var bottomHalf = context.getImageData(0, 0, elem.width, 33);
                                        context.clearRect(0, 0, elem.width, elem.height);

                                        // Since there's three parts, the top needs to be saved too for the next part (the
                                        // middle) to be drawn too.
                                        context.fillText(delimiter, elem.width / 2, 100 - fontTeX.fontDimen.depthOf(delimiter, family) * glyphHeight)
                                        var topHalf = context.getImageData(0, 0, elem.width, 33);
                                        context.clearRect(0, 0, elem.width, elem.height);

                                        // The middle is drawn here and the top and bottom parts are cleared.
                                        context.fillText(delimiter, elem.width / 2, elem.height / 2 + 50 - fontTeX.fontDimen.depthOf(delimiter, family) * glyphHeight);
                                        context.clearRect(0, 0, elem.width, Math.floor(elem.height / 2) - 17);
                                        context.clearRect(0, Math.ceil(elem.height / 2) + 17, elem.width, elem.height);

                                        context.putImageData(topHalf, 0, 0);
                                        context.putImageData(bottomHalf, 0, elem.height - 33);

                                        if (elem.height > 100) {
                                            // There are two regions that need to be filled in. The top one is done first.
                                            var topRegion = context.createImageData(elem.width, Math.ceil(elem.height / 2) - 50),
                                                topHalfRow = topHalf.data.slice(32 * elem.width * 4, 33 * elem.width * 4),
                                                bottomHalfRow = context.getImageData(0, Math.ceil(elem.height / 2) - 16, elem.width, 1).data;
                                            for (var i = 0, l = topRegion.height / 2; i < l; i++) {
                                                for (var n = 0, j = elem.width; n < j; n++) {
                                                    topRegion.data[i * elem.width * 4 + n * 4] = topHalfRow[n * 4];
                                                    topRegion.data[i * elem.width * 4 + n * 4 + 1] = topHalfRow[n * 4 + 1];
                                                    topRegion.data[i * elem.width * 4 + n * 4 + 2] = topHalfRow[n * 4 + 2];
                                                    topRegion.data[i * elem.width * 4 + n * 4 + 3] = topHalfRow[n * 4 + 3];
                                                    topRegion.data[~~(i + topRegion.height / 2) * elem.width * 4 + n * 4] = bottomHalfRow[n * 4];
                                                    topRegion.data[~~(i + topRegion.height / 2) * elem.width * 4 + n * 4 + 1] = bottomHalfRow[n * 4 + 1];
                                                    topRegion.data[~~(i + topRegion.height / 2) * elem.width * 4 + n * 4 + 2] = bottomHalfRow[n * 4 + 2];
                                                    topRegion.data[~~(i + topRegion.height / 2) * elem.width * 4 + n * 4 + 3] = bottomHalfRow[n * 4 + 3];
                                                }
                                            }
                                            var bottomRegion = context.createImageData(elem.width, Math.ceil(elem.height / 2) - 50),
                                                topHalfRow = context.getImageData(0, Math.floor(elem.height / 2) + 16, elem.width, 1).data,
                                                bottomHalfRow = bottomHalf.data.slice(0, elem.width * 4)
                                            for (var i = 0, l = topRegion.height / 2; i < l; i++) {
                                                for (var n = 0, j = elem.width; n < j; n++) {
                                                    bottomRegion.data[i * elem.width * 4 + n * 4] = topHalfRow[n * 4];
                                                    bottomRegion.data[i * elem.width * 4 + n * 4 + 1] = topHalfRow[n * 4 + 1];
                                                    bottomRegion.data[i * elem.width * 4 + n * 4 + 2] = topHalfRow[n * 4 + 2];
                                                    bottomRegion.data[i * elem.width * 4 + n * 4 + 3] = topHalfRow[n * 4 + 3];
                                                    bottomRegion.data[~~(i + topRegion.height / 2) * elem.width * 4 + n * 4] = bottomHalfRow[n * 4];
                                                    bottomRegion.data[~~(i + topRegion.height / 2) * elem.width * 4 + n * 4 + 1] = bottomHalfRow[n * 4 + 1];
                                                    bottomRegion.data[~~(i + topRegion.height / 2) * elem.width * 4 + n * 4 + 2] = bottomHalfRow[n * 4 + 2];
                                                    bottomRegion.data[~~(i + topRegion.height / 2) * elem.width * 4 + n * 4 + 3] = bottomHalfRow[n * 4 + 3];
                                                }
                                            }
                                            context.putImageData(topRegion, 0, 33);
                                            context.putImageData(bottomRegion, 0, elem.height / 2 + 17);
                                        }

                                        token.div.insertBefore(elem, leftSide ? token.div.firstElementChild : null);
                                        break;
                                }
                            }

                            renderElem(leftDelim, token.delims[0], true);
                            renderElem(rightDelim, token.delims[1], false);


                            // The whole fraction has been created now. All that's left is to calculate a new
                            // height and depth. Since the fraction is centered
                            token.div.renderedDepth = denom.renderedHeight + fontTeX.fontDimen.baselineHeightOf(family) - .5 + finalBarWidth / 2;
                            token.div.renderedHeight = numer.renderedHeight + denom.renderedHeight + finalBarWidth - token.div.renderedDepth;

                            // Since a fraction doesn't really count as a character, `lastChar' is set to just
                            // a space (a character without an italic correction).
                            lastChar = ' ';
                        } else parse1(9, i, l);
                        break;

                    case 9:
                        // This step isn't in regular TeX. This is where tables are handled. Plain TeX
                        // doesn't even have tables in math mode.
                        parse1(10, i, l);
                        break;

                    case 10:
                        // This is where all atoms are rendered fully. The inter-atom spacing is added la-
                        // ter, but this is where the atom itself is turned into HTML.
                        items.push(token);
                        atoms.push(token);
                        token.style = style;
                        token.div = document.createElement('div');
                        token.div.style.display = 'inline-block';
                        token.div.style.whiteSpace = 'nowrap';
                        token.div.renderedHeight = 0;
                        token.div.renderedDepth = 0;
                        if (token.invalid) {
                            if (token.nucleus && token.nucleus.type == 'symbol') token.nucleus.invalid = true;
                            else if (token.nucleus) {
                                for (var i = 0, l = token.nucleus.length; i < l; i++) {
                                    token.nucleus[i].invalid = true;
                                }
                            }
                            if (token.superscript) token.superscript[0].invalid = true;
                            if (token.subscript) token.subscript[0].invalid = true;
                        }
                        if (token.nucleus && token.nucleus.type == 'symbol') {
                            // If the atom's nucleus is a line break, (probably produced by "\\"), it should
                            // break the flex box by adding a 100% width element. It should also start a new
                            // child flex box though so that it'll actually be allowed to wrap.
                            if (token.nucleus.code == 10) {
                                token.isLineBreak = true;
                                token.div.style.width = '100%';
                            } else {
                                token.div.innerHTML = '<div style="display:inline-block;' + ({
                                    nm: token.atomType == 7 ? 'font-style:italic;margin:0 ' + fontTeX.fontDimen.italCorrOf(token.nucleus.char, family) + 'em 0 ' + fontTeX.fontDimen.leftOffsetOf(token.nucleus.char, family, 'it') + 'em;' : '',
                                    rm: '',
                                    bf: 'font-weight:bold;',
                                    it: 'font-style:italic;',
                                    sl: 'font-style:oblique;'
                                }[font]) + (token.nucleus.invalid ? 'color:red;' : '') + '">' + (token.nucleus.code == 45 ? '\u2212' : token.nucleus.char) + '</div>';

                                var fontStyle = font == 'nm' ? token.atomType == 7 ? 'it' : 'nm' : font;
                                token.div.renderedHeight = fontTeX.fontDimen.heightOf(token.nucleus.char, family, fontStyle);
                                token.div.renderedDepth = fontTeX.fontDimen.depthOf(token.nucleus.char, family, fontStyle);
                            }
                            lastChar = token.nucleus.char;
                        } else if (Array.isArray(token.nucleus)) {
                            lastChar = newBox(token.nucleus, style, cramped, font, token.div) || lastChar;
                        }

                        // Now a font-size needs to be set on the element to show differences between
                        // styles (e.g. if a \displaystyle was found inside a \scriptstyle group).
                        token.div.style.fontSize = ({
                            display:      {display:           1, text:           1, script: 0.707106781, scriptscript:         .5},
                            text:         {display:           1, text:           1, script: 0.707106781, scriptscript:         .5},
                            script:       {display: 1.414213562, text: 1.414213562, script:           1, scriptscript: .707106781},
                            scriptscript: {display:           2, text:           2, script: 1.414213562, scriptscript:          1}
                        })[flex.displayedStyle][style] + 'em';

                        // Now that the nucleus of the atom is done, only the sub/superscripts need to be
                        // created. After that, the atom is done being rendered. Here is where the scripts
                        // are made. Op atoms with limits displayed are special cases though. Their script
                        // are placed above and below their atoms instead of to the right like normal
                        // scripts. They are handled in the else if block following this if block.
                        if ((token.superscript || token.subscript) && (token.atomType != 1 || !token.limits)) {
                            if (token.subscript && !token.superscript) {
                                var sub = document.createElement('div');
                                sub.style.display = 'inline-block';
                                sub.style.verticalAlign = 'text-top';
                                sub.style.marginTop = '.4em';
                                newBox(token.subscript, style == 'display' || style == 'text' ? 'script' : 'scriptscript', cramped, font, sub);
                                // The height of the subscript if gotten by taking the boundingClientRect of the
                                // box. Visible height doesn't really matter here because it's not being aligned
                                // according to its visible height but by its actual physical height. Once the
                                // height is determined, it's counted as part of the depth of the atom. The font
                                // size is first set to 10px to set an artificial em value. After getting the
                                // height and dividing by 10, it'll be a ratio of its height to its em value.
                                sub.style.fontSize = '10px';
                                container.appendChild(sub);
                                var height = sub.getBoundingClientRect().height / 10;
                                container.removeChild(sub);
                                // If the style isn't already at scriptscript, then it'll be rendered at a smaller
                                // font.
                                if (style != 'scriptscript') {
                                    sub.style.fontSize = '.707106781em';
                                    height *= .707106781;
                                    sub.style.marginTop = '.565685425em';
                                } else sub.style.fontSize = '';
                                token.div.renderedDepth = Math.max(token.div.renderedDepth, height - .6);
                                token.div.appendChild(sub);
                            } else if (token.superscript && !token.subscript) {
                                // Superscripts are made the same way as subscripts. One difference though is that
                                // they are affected by the `cramped' argument. If `cramped' is true, the super-
                                // script is placed slightly lower than normal. It's used for when atoms are place
                                // in a denominator of a fraction or inside an \underlined atom.
                                var sup = document.createElement('div');
                                sup.style.display = 'inline-block';
                                sup.style.verticalAlign = 'text-bottom';
                                sup.style.paddingTop = cramped ? '.3em' : '.35em';
                                sup.style.position = 'relative';
                                sup.style.top = cramped ? '-.3em' : '-.35em';
                                newBox(token.superscript, style == 'display' || style == 'text' ? 'script' : 'scriptscript', cramped, font, sup);
                                sup.style.fontSize = '10px';
                                container.appendChild(sup);
                                var height = sup.getBoundingClientRect().height / 10;
                                container.removeChild(sup);
                                if (style != 'scriptscript') {
                                    sup.style.fontSize = '.707106781em';
                                    sup.style.paddingTop = cramped ? '.424264069em' : '.494974747em';
                                    sup.style.top = cramped ? '-.424264069em' : '-.494974747em';
                                    height *= .707106781;
                                } else sup.style.fontSize = '';
                                token.div.renderedHeight = Math.max(token.div.renderedHeight, height + (cramped ? .3 : .35));
                                token.div.appendChild(sup);
                            } else if (token.subscript && token.superscript) {
                                // If there's both a superscript and a subscript, they have to be positioned right
                                // on top of each other. That actually turns out being pretty easy. Both of the
                                // scripts are created like normal. Then, before placing them inside their parent,
                                // their widths are measured. The script with the thinner width is placed first and
                                // its width CSS property is set to 0. Then the other script is placed like normal.
                                // Since the first, thinner script has no width (but still a height to offset any
                                // lines around it), the second script still appears right next to the nucleus. The
                                // second script's width is unchanged, so any atoms after it are still offset by
                                // it. If both scripts have the same width, the subscript is chosen to act as the
                                // longer one (even though it really wouldn't matter if it was the other way a-
                                // round).

                                // First create the subscript without any styles applied yet. All the dimensions
                                // are also gotten from here.
                                var sub = document.createElement('div');
                                sub.style.display = 'inline-block';
                                newBox(token.subscript, style == 'display' || style == 'text' ? 'script' : 'scriptscript', cramped, font, sub);
                                sub.style.fontSize = '10px';
                                container.appendChild(sub);
                                var subDimens = sub.getBoundingClientRect();
                                container.removeChild(sub);

                                // Do the same for the superscript.
                                var sup = document.createElement('div');
                                sup.style.display = 'inline-block';
                                newBox(token.superscript, style == 'display' || style == 'text' ? 'script' : 'scriptscript', cramped, font, sup);
                                sup.style.fontSize = '10px';
                                container.appendChild(sup);
                                var supDimens = sup.getBoundingClientRect();
                                container.removeChild(sup);

                                // Now save some variables for differentiating between the thinner and the thicker
                                // one.
                                var thinner = supDimens.width > subDimens.width ? sub : sup,
                                    thicker = supDimens.width > subDimens.width ? sup : sub,
                                    height = supDimens.height / 10,
                                    depth = subDimens.height / 10;

                                // Now, all the styles are added like normal.
                                sub.style.verticalAlign = 'text-top';
                                sub.style.marginTop = '.5em';
                                sup.style.verticalAlign = 'text-bottom';
                                sup.style.paddingTop = cramped ? '.4em' : '.5em';
                                sup.style.position = 'relative';
                                sup.style.top = cramped ? '-.4em' : '-.5em';
                                if (style != 'scriptscript') {
                                    sub.style.fontSize = sup.style.fontSize = '.707106781em';
                                    height *= .707106781;
                                    depth *= .707106781;
                                    sub.style.marginTop = '.707106781em';
                                    sup.style.paddingTop = cramped ? '.565685425em' : '.707106781em';
                                    sup.style.top = cramped ? '-.565685425em' : '-.707106781em';
                                } else sub.style.fontSize = sup.style.fontSize = '';

                                // Height and depth are still calculated here.
                                token.div.renderedDepth = Math.max(token.div.renderedDepth, depth + .5);
                                token.div.renderedHeight = Math.max(token.div.renderedHeight, height + (cramped ? .4 : .5));

                                thinner.style.width = 0;

                                token.div.appendChild(thinner);
                                token.div.appendChild(thicker);
                            }
                        } else if ((token.superscript || token.subscript) && (token.atomType == 1 && token.limits)) {
                            // This is where Op atoms' scripts are handled. They are rendered in the same font
                            // size as normal scripts. The only difference is their position. They're kind of
                            // positioned like fractions in that the thinner of the three (nucleus, subscript,
                            // and superscript) is centered. That applies to the second thinnest as well.

                            var nucleusElem = token.div.firstElementChild;
                            container.appendChild(token.div);
                            var nucleusWidth = token.div.getBoundingClientRect().width;
                            container.removeChild(token.div);

                            if (token.subscript && !token.superscript) {
                                // If there's only a subscript, we only have to worry about the nucleus and the one
                                // script. First, the entire subscript is rendered inside its own box. After that,
                                // the same steps are taken that happen for fractions: the thinner of the nucleus
                                // and subscripts are placed inside their own special elements to get them to ren-
                                // der centered and in the right spot with the right spacing. Look at `case 8'
                                // (where fractions are created) for comments.

                                var sub = document.createElement('div');
                                sub.style.display = 'inline-block';
                                sub.style.verticalAlign = 'text-bottom';
                                sub.style.position = 'relative';
                                newBox(token.subscript, style == 'display' || style == 'text' ? 'script' : 'scriptscript', cramped, font, sub);

                                sub.style.fontSize = style == 'scriptscript' ? token.div.style.fontSize : 'calc(' + token.div.style.fontSize + ' * .707106781)';
                                container.appendChild(sub);
                                var width = sub.getBoundingClientRect().width;
                                sub.style.fontSize = '10px';
                                var height = sub.getBoundingClientRect().height / 10;
                                container.removeChild(sub);

                                if (style == 'scriptscript') {
                                    sub.style.fontSize = '';
                                    // The baselineHeight of a font family is how much space is between the baseline
                                    // and the bottom of the character's box. Taking away a character's depth from that
                                    // amount leaves only how much empty space there is below a character (a "y" for
                                    // example has less empty space below it than an "a" because the descender from the
                                    // "y" gives "y" a greater depth). This is what lets a subscript appear higher on
                                    // an "a" than on a "y" (try "\mathop y_1 \mathop a_1" to see the difference on the
                                    // "1").
                                    sub.style.top = height - fontTeX.fontDimen.baselineHeightOf(family) + token.div.renderedDepth + 'em';
                                    sub.style.paddingBottom = -height + fontTeX.fontDimen.baselineHeightOf(family) - token.div.renderedDepth + 'em';
                                    token.div.style.paddingBottom = height - fontTeX.fontDimen.baselineHeightOf(family) + token.div.renderedDepth + 'em';
                                } else {
                                    sub.style.fontSize = '.707106781em';
                                    sub.style.top = height - (fontTeX.fontDimen.baselineHeightOf(family) - token.div.renderedDepth) / .707106781 + 'em';
                                    sub.style.paddingBottom = -height - (fontTeX.fontDimen.baselineHeightOf(family) - token.div.renderedDepth) / -.707106781 + 'em';
                                    token.div.style.paddingBottom = height * .707106781 - fontTeX.fontDimen.baselineHeightOf(family) + token.div.renderedDepth + 'em';
                                }

                                // This is where the nucleus and subscript are positioned depending on their width.
                                if (width < nucleusWidth) {
                                    var thinner = sub.firstElementChild, thicker = nucleusElem;
                                    token.div.insertBefore(sub, nucleusElem);
                                    sub.style.width = 0;
                                } else {
                                    var thinner = nucleusElem, thicker = sub.firstElementChild;
                                    token.div.appendChild(sub);
                                }

                                var thinContainer = document.createElement('div');
                                thinContainer.style.display = 'inline-block';
                                thinContainer.style.position = 'relative';
                                var heightContainer = document.createElement('div');
                                heightContainer.style.display = 'inline-block';
                                heightContainer.style.width = 0;
                                heightContainer.style.opacity = 0;
                                heightContainer.style.webkitUserSelect =
                                    heightContainer.style.mozUserSelect =
                                    heightContainer.style.msUserSelect =
                                    heightContainer.style.userSelect = 'none';
                                heightContainer.appendChild(noWrap(thinner.cloneNode(true)));
                                thinContainer.appendChild(heightContainer);
                                var widthCont = document.createElement('div');
                                widthCont.style.position = 'absolute';
                                widthCont.style.left = widthCont.style.right = 0;
                                widthCont.style.textAlign = 'center';
                                widthCont.style.display = 'inline-block';
                                widthCont.appendChild(thinner);
                                thinContainer.appendChild(widthCont);
                                var clone = noWrap(thicker.cloneNode(true));
                                clone.style.opacity = 0;
                                clone.style.webkitUserSelect =
                                    clone.style.mozUserSelect =
                                    clone.style.msUserSelect =
                                    clone.style.userSelect = 'none';
                                clone.style.pointerEvents = 'none';
                                clone.style.fontSize = style == 'scriptscript' ? '' : width < nucleusWidth ? '1.414213562em' : '.707106781em';
                                clone.style.height = 0;
                                clone.style.verticalAlign = 'top';
                                thinContainer.appendChild(clone);
                                if (width < nucleusWidth) {
                                    sub.appendChild(thinContainer);
                                } else {
                                    var nucleusPar = document.createElement('div');
                                    nucleusPar.style.display = 'inline-block';
                                    nucleusPar.style.width = 0;
                                    nucleusPar.appendChild(thinContainer);
                                    token.div.insertBefore(nucleusPar, sub);
                                }

                                // Since the subscript in its entirety is being added on right under the atom, all
                                // of its height and depth are adding on to the depth of the atom.
                                token.div.renderedDepth += sub.renderedHeight + sub.renderedDepth;
                            } else if (token.superscript && !token.subscript) {
                                // This is the superscript version of the above.
                                var sup = document.createElement('div');
                                sup.style.display = 'inline-block';
                                sup.style.verticalAlign = 'text-bottom';
                                newBox(token.superscript, style == 'display' || style == 'text' ? 'script' : 'scriptscript', cramped, font, sup);

                                sup.style.fontSize = style == 'scriptscript' ? token.div.style.fontSize : 'calc(' + token.div.style.fontSize + ' * .707106781)';
                                container.appendChild(sup);
                                var width = sup.getBoundingClientRect().width;
                                container.removeChild(sup);

                                if (style == 'scriptscript') {
                                    sup.style.fontSize = '';
                                    sup.style.marginBottom = fontTeX.fontDimen.baselineHeightOf(family) + token.div.renderedHeight + 'em';
                                } else {
                                    sup.style.fontSize = '.707106781em';
                                    sup.style.marginBottom = 'calc(' + (fontTeX.fontDimen.baselineHeightOf(family) + token.div.renderedHeight) + 'em / .707106781)';
                                }

                                if (width < nucleusWidth) {
                                    var thinner = sup.firstElementChild, thicker = nucleusElem;
                                    token.div.insertBefore(sup, nucleusElem);
                                    sup.style.width = 0;
                                } else {
                                    var thinner = nucleusElem, thicker = sup.firstElementChild;
                                    token.div.appendChild(sup);
                                }

                                var thinContainer = document.createElement('div');
                                thinContainer.style.display = 'inline-block';
                                thinContainer.style.position = 'relative';
                                var heightContainer = document.createElement('div');
                                heightContainer.style.display = 'inline-block';
                                heightContainer.style.width = 0;
                                heightContainer.style.opacity = 0;
                                heightContainer.style.webkitUserSelect =
                                    heightContainer.style.mozUserSelect =
                                    heightContainer.style.msUserSelect =
                                    heightContainer.style.userSelect = 'none';
                                heightContainer.appendChild(noWrap(thinner.cloneNode(true)));
                                thinContainer.appendChild(heightContainer);
                                var widthCont = document.createElement('div');
                                widthCont.style.position = 'absolute';
                                widthCont.style.left = widthCont.style.right = 0;
                                widthCont.style.textAlign = 'center';
                                widthCont.style.display = 'inline-block';
                                widthCont.appendChild(thinner);
                                thinContainer.appendChild(widthCont);
                                var clone = noWrap(thicker.cloneNode(true));
                                clone.style.opacity = 0;
                                clone.style.webkitUserSelect =
                                    clone.style.mozUserSelect =
                                    clone.style.msUserSelect =
                                    clone.style.userSelect = 'none';
                                clone.style.pointerEvents = 'none';
                                clone.style.fontSize = style == 'scriptscript' ? '' : width < nucleusWidth ? '1.414213562em' : '.707106781em';
                                clone.style.height = 0;
                                clone.style.verticalAlign = 'top';
                                thinContainer.appendChild(clone);
                                if (width < nucleusWidth) {
                                    sup.appendChild(thinContainer);
                                } else {
                                    var nucleusPar = document.createElement('div');
                                    nucleusPar.style.display = 'inline-block';
                                    nucleusPar.style.width = 0;
                                    nucleusPar.appendChild(thinContainer);
                                    token.div.insertBefore(nucleusPar, sup);
                                }

                                token.div.renderedHeight += sup.renderedHeight + sup.renderedDepth;
                            } else if (token.superscript && token.subscript) {
                                // Both a superscript and subscript are rendered the same way they are separately.
                                // The only difference is that three things' widths are compared instead of just
                                // two.

                                var sub = document.createElement('div');
                                sub.style.display = 'inline-block';
                                sub.style.verticalAlign = 'text-bottom';
                                sub.style.position = 'relative';
                                newBox(token.subscript, style == 'display' || style == 'text' ? 'script' : 'scriptscript', cramped, font, sub);

                                sub.style.fontSize = style == 'scriptscript' ? token.div.style.fontSize : 'calc(' + token.div.style.fontSize + ' * .707106781)';
                                container.appendChild(sub);
                                var subWidth = sub.getBoundingClientRect().width;
                                sub.style.fontSize = '10px';
                                var height = sub.getBoundingClientRect().height / 10;
                                container.removeChild(sub);

                                var sup = document.createElement('div');
                                sup.style.display = 'inline-block';
                                sup.style.verticalAlign = 'text-bottom';
                                sup.style.position = 'relative';
                                newBox(token.superscript, style == 'display' || style == 'text' ? 'script' : 'scriptscript', cramped, font, sup);

                                sup.style.fontSize = style == 'scriptscript' ? token.div.style.fontSize : 'calc(' + token.div.style.fontSize + ' * .707106781)';
                                container.appendChild(sup);
                                var supWidth = sup.getBoundingClientRect().width;
                                container.removeChild(sup);

                                if (style == 'scriptscript') {
                                    sub.style.fontSize = sup.style.fontSize = '';
                                    sub.style.top = height - fontTeX.fontDimen.baselineHeightOf(family) + token.div.renderedDepth + 'em';
                                    sub.style.paddingBottom = -height + fontTeX.fontDimen.baselineHeightOf(family) - token.div.renderedDepth + 'em';
                                    token.div.style.paddingBottom = height - fontTeX.fontDimen.baselineHeightOf(family) + token.div.renderedDepth + 'em';
                                    sup.style.marginBottom = fontTeX.fontDimen.baselineHeightOf(family) + token.div.renderedHeight + 'em';
                                } else {
                                    sub.style.fontSize = sup.style.fontSize = '.707106781em';
                                    sub.style.top = height - (fontTeX.fontDimen.baselineHeightOf(family) - token.div.renderedDepth) / .707106781 + 'em';
                                    sub.style.paddingBottom = -height - (fontTeX.fontDimen.baselineHeightOf(family) - token.div.renderedDepth) / -.707106781 + 'em';
                                    token.div.style.paddingBottom = height * .707106781 - fontTeX.fontDimen.baselineHeightOf(family) + token.div.renderedDepth + 'em';
                                    sup.style.marginBottom = (fontTeX.fontDimen.baselineHeightOf(family) + token.div.renderedHeight) / .707106781 + 'em';
                                }

                                if (subWidth <= supWidth && nucleusWidth <= supWidth) {
                                    token.div.insertBefore(sub, nucleusElem);
                                    token.div.appendChild(sup);
                                    sub.style.width = nucleusElem.style.width = 0;

                                    var subThinContainer = document.createElement('div'),
                                        nucThinContainer = document.createElement('div');
                                    subThinContainer.style.display = nucThinContainer.style.display = 'inline-block';
                                    subThinContainer.style.position = nucThinContainer.style.position = 'relative';
                                    var subHeightContainer = document.createElement('div'),
                                        nucHeightContainer = document.createElement('div');
                                    subHeightContainer.style.display = nucHeightContainer.style.display = 'inline-block';
                                    subHeightContainer.style.width = nucHeightContainer.style.width = 0;
                                    subHeightContainer.style.opacity = nucHeightContainer.style.opacity = 0;
                                    subHeightContainer.style.webkitUserSelect =
                                        subHeightContainer.style.mozUserSelect =
                                        subHeightContainer.style.msUserSelect =
                                        subHeightContainer.style.userSelect =
                                        nucHeightContainer.style.webkitUserSelect =
                                        nucHeightContainer.style.mozUserSelect =
                                        nucHeightContainer.style.msUserSelect =
                                        nucHeightContainer.style.userSelect = 'none';
                                    subHeightContainer.appendChild(noWrap(sub.firstElementChild.cloneNode(true)));
                                    nucHeightContainer.appendChild(noWrap(nucleusElem.cloneNode(true)));
                                    subThinContainer.appendChild(subHeightContainer);
                                    nucThinContainer.appendChild(nucHeightContainer);
                                    var subWidthCont = document.createElement('div'),
                                        nucWidthCont = document.createElement('div');
                                    subWidthCont.style.position = nucWidthCont.style.position = 'absolute';
                                    subWidthCont.style.left = subWidthCont.style.right = 0;
                                    nucWidthCont.style.left = nucWidthCont.style.right = 0;
                                    subWidthCont.style.textAlign = nucWidthCont.style.textAlign = 'center';
                                    subWidthCont.style.display = nucWidthCont.style.display = 'inline-block';
                                    subWidthCont.appendChild(sub.firstElementChild);
                                    nucWidthCont.appendChild(nucleusElem);
                                    subThinContainer.appendChild(subWidthCont);
                                    nucThinContainer.appendChild(nucWidthCont);
                                    var subClone = noWrap(sup.firstElementChild.cloneNode(true)),
                                        nucClone = subClone.cloneNode(true);
                                    subClone.style.opacity = nucClone.style.opacity = 0;
                                    subClone.style.webkitUserSelect =
                                        subClone.style.mozUserSelect =
                                        subClone.style.msUserSelect =
                                        subClone.style.userSelect =
                                        nucClone.style.webkitUserSelect =
                                        nucClone.style.mozUserSelect =
                                        nucClone.style.msUserSelect =
                                        nucClone.style.userSelect = 'none';
                                    subClone.style.pointerEvents = nucClone.style.pointerEvents = 'none';
                                    subClone.style.fontSize = '';
                                    nucClone.style.fontSize = style == 'scriptscript' ? '' : '.707106781em';
                                    subClone.style.height = nucClone.style.height = 0;
                                    subClone.style.verticalAlign = nucClone.style.verticalAlign = 'top';
                                    subThinContainer.appendChild(subClone);
                                    nucThinContainer.appendChild(nucClone);
                                    sub.appendChild(subThinContainer);
                                    var nucleusPar = document.createElement('div');
                                    nucleusPar.style.display = 'inline-block';
                                    nucleusPar.style.width = 0;
                                    nucleusPar.appendChild(nucThinContainer);
                                    token.div.insertBefore(nucleusPar, sup);
                                } else if (subWidth <= nucleusWidth && supWidth <= nucleusWidth) {
                                    token.div.insertBefore(sub, nucleusElem);
                                    token.div.insertBefore(sup, nucleusElem);
                                    sub.style.width = sup.style.width = 0;

                                    var subThinContainer = document.createElement('div'),
                                        supThinContainer = document.createElement('div');
                                    subThinContainer.style.display = supThinContainer.style.display = 'inline-block';
                                    subThinContainer.style.position = supThinContainer.style.position = 'relative';
                                    var subHeightContainer = document.createElement('div'),
                                        supHeightContainer = document.createElement('div');
                                    subHeightContainer.style.display = supHeightContainer.style.display = 'inline-block';
                                    subHeightContainer.style.width = supHeightContainer.style.width = 0;
                                    subHeightContainer.style.opacity = supHeightContainer.style.opacity = 0;
                                    subHeightContainer.style.webkitUserSelect =
                                        subHeightContainer.style.mozUserSelect =
                                        subHeightContainer.style.msUserSelect =
                                        subHeightContainer.style.userSelect =
                                        supHeightContainer.style.webkitUserSelect =
                                        supHeightContainer.style.mozUserSelect =
                                        supHeightContainer.style.msUserSelect =
                                        supHeightContainer.style.userSelect = 'none';
                                    subHeightContainer.appendChild(noWrap(sub.firstElementChild.cloneNode(true)));
                                    supHeightContainer.appendChild(noWrap(sup.firstElementChild.cloneNode(true)));
                                    subThinContainer.appendChild(subHeightContainer);
                                    supThinContainer.appendChild(supHeightContainer);
                                    var subWidthCont = document.createElement('div'),
                                        supWidthCont = document.createElement('div');
                                    subWidthCont.style.position = supWidthCont.style.position = 'absolute';
                                    subWidthCont.style.left = subWidthCont.style.right = 0;
                                    supWidthCont.style.left = supWidthCont.style.right = 0;
                                    subWidthCont.style.textAlign = supWidthCont.style.textAlign = 'center';
                                    subWidthCont.style.display = supWidthCont.style.display = 'inline-block';
                                    subWidthCont.appendChild(sub.firstElementChild);
                                    supWidthCont.appendChild(sup.firstElementChild);
                                    subThinContainer.appendChild(subWidthCont);
                                    supThinContainer.appendChild(supWidthCont);
                                    var subClone = noWrap(nucleusElem.cloneNode(true)),
                                        supClone = subClone.cloneNode(true);
                                    subClone.style.opacity = supClone.style.opacity = 0;
                                    subClone.style.webkitUserSelect =
                                        subClone.style.mozUserSelect =
                                        subClone.style.msUserSelect =
                                        subClone.style.userSelect =
                                        supClone.style.webkitUserSelect =
                                        supClone.style.mozUserSelect =
                                        supClone.style.msUserSelect =
                                        supClone.style.userSelect = 'none';
                                    subClone.style.pointerEvents = supClone.style.pointerEvents = 'none';
                                    subClone.style.fontSize = supClone.style.fontSize = style == 'scriptscript' ? '' : '1.414213562em';
                                    subClone.style.height = supClone.style.height = 0;
                                    subClone.style.verticalAlign = supClone.style.verticalAlign = 'top';
                                    subThinContainer.appendChild(subClone);
                                    supThinContainer.appendChild(supClone);
                                    sub.appendChild(subThinContainer);
                                    sup.appendChild(supThinContainer);
                                } else if (nucleusWidth <= subWidth && supWidth <= subWidth) {
                                    token.div.insertBefore(sup, nucleusElem);
                                    token.div.appendChild(sub);
                                    sup.style.width = nucleusElem.style.width = 0;

                                    var supThinContainer = document.createElement('div'),
                                        nucThinContainer = document.createElement('div');
                                    supThinContainer.style.display = nucThinContainer.style.display = 'inline-block';
                                    supThinContainer.style.position = nucThinContainer.style.position = 'relative';
                                    var supHeightContainer = document.createElement('div'),
                                        nucHeightContainer = document.createElement('div');
                                    supHeightContainer.style.display = nucHeightContainer.style.display = 'inline-block';
                                    supHeightContainer.style.width = nucHeightContainer.style.width = 0;
                                    supHeightContainer.style.opacity = nucHeightContainer.style.opacity = 0;
                                    supHeightContainer.style.webkitUserSelect =
                                        supHeightContainer.style.mozUserSelect =
                                        supHeightContainer.style.msUserSelect =
                                        supHeightContainer.style.userSelect =
                                        nucHeightContainer.style.webkitUserSelect =
                                        nucHeightContainer.style.mozUserSelect =
                                        nucHeightContainer.style.msUserSelect =
                                        nucHeightContainer.style.userSelect = 'none';
                                    supHeightContainer.appendChild(noWrap(sup.firstElementChild.cloneNode(true)));
                                    nucHeightContainer.appendChild(noWrap(nucleusElem.cloneNode(true)));
                                    supThinContainer.appendChild(supHeightContainer);
                                    nucThinContainer.appendChild(nucHeightContainer);
                                    var supWidthCont = document.createElement('div'),
                                        nucWidthCont = document.createElement('div');
                                    supWidthCont.style.position = nucWidthCont.style.position = 'absolute';
                                    supWidthCont.style.left = supWidthCont.style.right = 0;
                                    nucWidthCont.style.left = nucWidthCont.style.right = 0;
                                    supWidthCont.style.textAlign = nucWidthCont.style.textAlign = 'center';
                                    supWidthCont.style.display = nucWidthCont.style.display = 'inline-block';
                                    supWidthCont.appendChild(sup.firstElementChild);
                                    nucWidthCont.appendChild(nucleusElem);
                                    supThinContainer.appendChild(supWidthCont);
                                    nucThinContainer.appendChild(nucWidthCont);
                                    var supClone = noWrap(sub.firstElementChild.cloneNode(true)),
                                        nucClone = supClone.cloneNode(true);
                                    supClone.style.opacity = nucClone.style.opacity = 0;
                                    supClone.style.webkitUserSelect =
                                        supClone.style.mozUserSelect =
                                        supClone.style.msUserSelect =
                                        supClone.style.userSelect =
                                        nucClone.style.webkitUserSelect =
                                        nucClone.style.mozUserSelect =
                                        nucClone.style.msUserSelect =
                                        nucClone.style.userSelect = 'none';
                                    supClone.style.pointerEvents = nucClone.style.pointerEvents = 'none';
                                    supClone.style.fontSize = '';
                                    nucClone.style.fontSize = style == 'scriptscript' ? '' : '.707106781em';
                                    supClone.style.height = nucClone.style.height = 0;
                                    supClone.style.verticalAlign = nucClone.style.verticalAlign = 'top';
                                    supThinContainer.appendChild(supClone);
                                    nucThinContainer.appendChild(nucClone);
                                    sup.appendChild(supThinContainer);
                                    var nucleusPar = document.createElement('div');
                                    nucleusPar.style.display = 'inline-block';
                                    nucleusPar.style.width = 0;
                                    nucleusPar.appendChild(nucThinContainer);
                                    token.div.insertBefore(nucleusPar, sub);
                                }


                                token.div.renderedHeight += sup.renderedHeight + sup.renderedDepth;
                                token.div.renderedDepth += sub.renderedHeight + sub.renderedDepth;
                            }
                        }


                        // If the current token is marked as delimited, then a pair of delimiters is added
                        // to the div. Delimiters appear from \left \right pairs.
                        if (token.delimited) {
                            // `leftDelim' and `rightDelim' are both the elements where the delimiters are dis-
                            // played. If no delimiter was specified, then the value of \nulldelimiterspace is
                            // added instead as a kern token.
                            var leftDelim = document.createElement('canvas'),
                                rightDelim = document.createElement('canvas');

                            leftDelim.style.display = rightDelim.style.display = 'inline-block';

                            if (token.delims[0] == '>') token.delims[0] = '⟩';
                            if (token.delims[1] == '>') token.delims[1] = '⟩';
                            if (token.delims[0] == '<') token.delims[0] = '⟨';
                            if (token.delims[1] == '<') token.delims[1] = '⟨';

                            function renderElem(elem, delimiter, leftSide) {
                                switch (delimiter) {
                                    case '.':
                                    default:
                                        // This case is for when no delimiter was specified (using a "."). It just adds a
                                        // kern instead of trying to draw a character.
                                        items.splice(items.length - (leftSide ? 1 : 0), 0, {
                                            type: 'kern',
                                            dimen: token.nullDelimiterSpace
                                        });
                                        break;

                                    case '|':
                                    case '/':
                                    case '\\':
                                    case '‖':
                                    case '⎪':
                                    case '⏐':
                                    case '⟨':
                                    case '⟩':
                                        // This is the simplest case (other than the one with no delimiter). If the charac-
                                        // ter falls into this category, it's just stretched. Nothing special. The whole
                                        // character is placed into a canvas and given a height. The canvas will stretch
                                        // with the character inside.

                                        // The total height of the delimiter is found by taking the taller of the height
                                        // and depth of `token.div' (accounting for the offset from the baseline to the
                                        // center of the line) and multiplying by two. So even if there's a fraction or
                                        // something with a huge height but no depth, the delimiter will still act as if
                                        // they had the same height and depth. The minimum height of a delimiter is 1 so
                                        // that a character like a "-" won't just have a super small, weird looking delimi
                                        // iter.
                                        var height = .5 - fontTeX.fontDimen.baselineHeightOf(family);
                                        height = Math.max(token.div.renderedHeight - height, token.div.renderedDepth + height, (fontTeX.fontDimen.heightOf(delimiter, family) + fontTeX.fontDimen.depthOf(delimiter, family)) / 2) * 2;
                                        elem.style.height = height + 'em';
                                        elem.style.width = fontTeX.fontDimen.widthOf(delimiter, family) + 'em';
                                        elem.style.verticalAlign = 'middle';

                                        // The height of the canvas is set to 100 (all of its coordinates are based on the
                                        // height). The width is found out by setting up the ratio [width] / [character's
                                        // physical width] = 100 / [character's visible height]. The physical width is used
                                        // so that the delimiter will look as closely to a real character as possible.
                                        elem.height = 100;
                                        elem.width = fontTeX.fontDimen.widthOf(delimiter, family) / (fontTeX.fontDimen.heightOf(delimiter, family) + fontTeX.fontDimen.depthOf(delimiter, family)) * 100;
                                        var context = elem.getContext('2d');
                                        context.textAlign = 'center';
                                        // The font is set to the current family with a font-size that will draw the char-
                                        // acter such that its height + depth will take up 100px (the entirety of the can-
                                        // vas).
                                        context.font = 100 / (fontTeX.fontDimen.heightOf(delimiter, family) + fontTeX.fontDimen.depthOf(delimiter, family)) + 'px ' + family;
                                        // Now the character is drawn. The x coordinate is set in the middle of the canvas
                                        // to ensure the character is drawn right in the center, like a normal character
                                        // would outside of a canvas. The y coordinate though is offset by the character's
                                        // depth so that the bottom of the visible character will be at the bottom of the
                                        // canvas (if it was just 100, everything below the character's baseline would be
                                        // cropped off).
                                        context.fillText(delimiter, elem.width / 2, 100 - fontTeX.fontDimen.depthOf(delimiter, family) * 100 / (fontTeX.fontDimen.heightOf(delimiter, family) + fontTeX.fontDimen.depthOf(delimiter, family)));
                                        // Now the canvas is inserted into the element.
                                        token.div.insertBefore(elem, leftSide ? token.div.firstElementChild : null);
                                        break;

                                    case '(':
                                    case ')':
                                        // This block accounts for parentheses. Parentheses can't just be stretched to any
                                        // amount like the previous block because then they just start to look like really
                                        // long "|". But parentheses CAN be stretched a little before they start looking
                                        // weird. This block will stretch a parenthesis to a maximum of two times its nor-
                                        // mal height. If the desired height is any bigger than that, then only the middle,
                                        // most vertical part of the parenthesis will stretch. This happens in normal TeX
                                        // too (it probably allows for stretching past two times, but then again it has
                                        // special characters for that; all we have here is the one).

                                        var height = .5 - fontTeX.fontDimen.baselineHeightOf(family);
                                        height = Math.max(token.div.renderedHeight - height, token.div.renderedDepth + height, (fontTeX.fontDimen.heightOf(delimiter, family) + fontTeX.fontDimen.depthOf(delimiter, family)) / 2) * 2;
                                        elem.style.height = height + 'em';
                                        elem.style.width = fontTeX.fontDimen.widthOf(delimiter, family) + 'em';
                                        elem.style.verticalAlign = 'middle';

                                        if (height <= 2) {
                                            // If the height is less than 2, the character can be drawn normally and then just
                                            // stretched. The code below is copied from the second case item.

                                            elem.height = 100;
                                            elem.width = fontTeX.fontDimen.widthOf(delimiter, family) / fontTeX.fontDimen.heightOf(delimiter, family) * 100 * (fontTeX.fontDimen.heightOf(delimiter, family) + fontTeX.fontDimen.depthOf(delimiter, family));
                                            var context = elem.getContext('2d');
                                            context.textAlign = 'center';
                                            context.font = 100 / (fontTeX.fontDimen.heightOf(delimiter, family) + fontTeX.fontDimen.depthOf(delimiter, family)) + 'px ' + family;
                                            context.translate(0, 100);
                                            context.fillText(delimiter, elem.width / 2, -fontTeX.fontDimen.depthOf(delimiter, family) * 100 / (fontTeX.fontDimen.heightOf(delimiter, family) + fontTeX.fontDimen.depthOf(delimiter, family)));
                                        } else {
                                            // If the desired height is greater than two times its normal height, extra steps
                                            // are necessary to get to its desired height without making it look weird.

                                            // To begin, two characters need to be drawn. One will be used for the bottom of
                                            // the parenthesis, the other for the top. We need to keep them separate though.
                                            // Consider an example where the height is only off by 1px. If we just draw both
                                            // character (one at the top of the canvas, the other at the bottom) and clear the
                                            // rectangle between their two halves, only one row of one pixel will actually be
                                            // cleared. That's a problem because the top character will also be visible in the
                                            // bottom character's space because they're too close together. To prevent that,
                                            // the bottom is drawn first (only the bottom half), copied in an `ImageData', then
                                            // deleted from the canvas. Then the top is drawn and cropped (so only the top half
                                            // remains). Now, since the bottom half of the canvas has been cleared, the copy of
                                            // the bottom half of the character can be pasted. Now, even though the two would
                                            // normally overlap, they don't because they were drawn separately.
                                            var glyphHeight = (fontTeX.fontDimen.heightOf(delimiter, family) + fontTeX.fontDimen.depthOf(delimiter, family));
                                            elem.height = height * 50;
                                            elem.width = fontTeX.fontDimen.widthOf(delimiter, family) / fontTeX.fontDimen.heightOf(delimiter, family) * 100 * (fontTeX.fontDimen.heightOf(delimiter, family) + fontTeX.fontDimen.depthOf(delimiter, family));
                                            var context = elem.getContext('2d');
                                            context.textAlign = 'center';
                                            context.font = 100 / glyphHeight + 'px ' + family;
                                            context.fillText(delimiter, elem.width / 2, 50 - fontTeX.fontDimen.depthOf(delimiter, family) * 100 / glyphHeight);
                                            // Now that the bottom half of the first glyph has been drawn, an `ImageData' saves
                                            // the pixels so they can be put on the canvas later.
                                            var bottomHalf = context.getImageData(0, 0, elem.width, 50);
                                            context.clearRect(0, 0, elem.width, elem.height);
                                            // The top half needs to be drawn now.
                                            context.fillText(delimiter, elem.width / 2, 100 - fontTeX.fontDimen.depthOf(delimiter, family) * 100 / glyphHeight)
                                            context.clearRect(0, 50, elem.width, elem.height);
                                            // Now paste the bottom half.
                                            context.putImageData(bottomHalf, 0, elem.height - 50);
                                            // All that's left to do is to connect them. To do that, a new `ImageData' instance
                                            // is made where we can manipulate individual pixels. It will have the height of
                                            // empty region of the canvas (the space between the two halves). For the top half
                                            // of the `ImageData', the bottommost pixel of the top half character is copied and
                                            // pasted over and over on top of each other, one row at a time. The same thing
                                            // happens for the bottom half. It looks really inefficient below because it liter-
                                            // ally sets every single RGBA channel of every single pixel of every single row.
                                            // Since an `ImageData's `data' attribute is readonly though, you can't make a new
                                            // array and replace it, you have to change each individual value.
                                            var region = context.createImageData(elem.width, elem.height - 100);
                                            var topHalfRow = context.getImageData(0, 49, elem.width, 1).data,
                                                bottomHalfRow = bottomHalf.data.slice(0, elem.width * 4);
                                            for (var i = 0, l = region.height / 2; i < l; i++) {
                                                for (var n = 0, j = elem.width; n < j; n++) {
                                                    region.data[i * elem.width * 4 + n * 4] = topHalfRow[n * 4];
                                                    region.data[i * elem.width * 4 + n * 4 + 1] = topHalfRow[n * 4 + 1];
                                                    region.data[i * elem.width * 4 + n * 4 + 2] = topHalfRow[n * 4 + 2];
                                                    region.data[i * elem.width * 4 + n * 4 + 3] = topHalfRow[n * 4 + 3];
                                                    region.data[~~(i + region.height / 2) * elem.width * 4 + n * 4] = bottomHalfRow[n * 4];
                                                    region.data[~~(i + region.height / 2) * elem.width * 4 + n * 4 + 1] = bottomHalfRow[n * 4 + 1];
                                                    region.data[~~(i + region.height / 2) * elem.width * 4 + n * 4 + 2] = bottomHalfRow[n * 4 + 2];
                                                    region.data[~~(i + region.height / 2) * elem.width * 4 + n * 4 + 3] = bottomHalfRow[n * 4 + 3];
                                                }
                                            }
                                            // The pixels have all been copied. After it gets pasted below, the two halves will
                                            // be connected.
                                            context.putImageData(region, 0, 50);
                                        }
                                        token.div.insertBefore(elem, leftSide ? token.div.firstElementChild : null);
                                        break;

                                    case '[':
                                    case ']':
                                    case '⟮':
                                    case '⟯':
                                    case '↑':
                                    case '↓':
                                    case '↕':
                                    case '⇑':
                                    case '⇓':
                                    case '⇕':
                                    case '⌈':
                                    case '⌉':
                                    case '⌊':
                                    case '⌋':
                                    case '⎰':
                                    case '⎱':
                                        // These characters expand at the middle similar to how the parentheses do. The
                                        // only difference is that they don't try to stretch to twice their height first.
                                        // The code below is coped from the third case item.

                                        var height = .5 - fontTeX.fontDimen.baselineHeightOf(family);
                                        height = Math.max(token.div.renderedHeight - height, token.div.renderedDepth + height, (fontTeX.fontDimen.heightOf(delimiter, family) + fontTeX.fontDimen.depthOf(delimiter, family)) / 2) * 2;
                                        elem.style.height = height + 'em';
                                        elem.style.width = fontTeX.fontDimen.widthOf(delimiter, family) + 'em';
                                        elem.style.verticalAlign = 'middle';
                                        var glyphHeight = 100 / (fontTeX.fontDimen.heightOf(delimiter, family) + fontTeX.fontDimen.depthOf(delimiter, family));
                                        elem.height = Math.max(height, 1) * 100;
                                        elem.width = fontTeX.fontDimen.widthOf(delimiter, family) / fontTeX.fontDimen.heightOf(delimiter, family) * 100 * (fontTeX.fontDimen.heightOf(delimiter, family) + fontTeX.fontDimen.depthOf(delimiter, family));
                                        var context = elem.getContext('2d');
                                        context.textAlign = 'center';
                                        context.font = glyphHeight + 'px ' + family;
                                        context.fillText(delimiter, elem.width / 2, 50 - fontTeX.fontDimen.depthOf(delimiter, family) * glyphHeight);

                                        var bottomHalf = context.getImageData(0, 0, elem.width, 50);
                                        context.clearRect(0, 0, elem.width, elem.height);

                                        context.fillText(delimiter, elem.width / 2, 100 - fontTeX.fontDimen.depthOf(delimiter, family) * glyphHeight)
                                        context.clearRect(0, 50, elem.width, elem.height);

                                        context.putImageData(bottomHalf, 0, elem.height - 50);

                                        if (elem.height > 100) {
                                            var region = context.createImageData(elem.width, elem.height - 100);
                                            var topHalfRow = context.getImageData(0, 49, elem.width, 1).data,
                                                bottomHalfRow = bottomHalf.data.slice(0, elem.width * 4);
                                            for (var i = 0, l = region.height / 2; i < l; i++) {
                                                for (var n = 0, j = elem.width; n < j; n++) {
                                                    region.data[i * elem.width * 4 + n * 4] = topHalfRow[n * 4];
                                                    region.data[i * elem.width * 4 + n * 4 + 1] = topHalfRow[n * 4 + 1];
                                                    region.data[i * elem.width * 4 + n * 4 + 2] = topHalfRow[n * 4 + 2];
                                                    region.data[i * elem.width * 4 + n * 4 + 3] = topHalfRow[n * 4 + 3];
                                                    region.data[~~(i + region.height / 2) * elem.width * 4 + n * 4] = bottomHalfRow[n * 4];
                                                    region.data[~~(i + region.height / 2) * elem.width * 4 + n * 4 + 1] = bottomHalfRow[n * 4 + 1];
                                                    region.data[~~(i + region.height / 2) * elem.width * 4 + n * 4 + 2] = bottomHalfRow[n * 4 + 2];
                                                    region.data[~~(i + region.height / 2) * elem.width * 4 + n * 4 + 3] = bottomHalfRow[n * 4 + 3];
                                                }
                                            }
                                            context.putImageData(region, 0, 50);
                                        }

                                        token.div.insertBefore(elem, leftSide ? token.div.firstElementChild : null);
                                        break;

                                    case '{':
                                    case '}':
                                        // Curly braces are expanded in two places compared to other delimiters: once at
                                        // one third quarter up and the other at two thirds (between the things sticking
                                        // out on the side). It works for most fonts, but it might still look kind of weird
                                        // for others. There's no way to know for sure where to cut up the character other
                                        // than looking at individual pixels and looking for where the character seems most
                                        // vertically flat, which seems like a long, unnecessary and hard task for some-
                                        // thing small like this. It still works for most cases.

                                        var height = .5 - fontTeX.fontDimen.baselineHeightOf(family);
                                        height = Math.max(token.div.renderedHeight - height, token.div.renderedDepth + height, (fontTeX.fontDimen.heightOf(delimiter, family) + fontTeX.fontDimen.depthOf(delimiter, family)) / 2) * 2;
                                        elem.style.height = height + 'em';
                                        elem.style.width = fontTeX.fontDimen.widthOf(delimiter, family) + 'em';
                                        elem.style.verticalAlign = 'middle';
                                        var glyphHeight = 100 / (fontTeX.fontDimen.heightOf(delimiter, family) + fontTeX.fontDimen.depthOf(delimiter, family));
                                        elem.height = Math.max(height, 1) * 100;
                                        elem.width = fontTeX.fontDimen.widthOf(delimiter, family) / fontTeX.fontDimen.heightOf(delimiter, family) * 100 * (fontTeX.fontDimen.heightOf(delimiter, family) + fontTeX.fontDimen.depthOf(delimiter, family));
                                        var context = elem.getContext('2d');
                                        context.textAlign = 'center';
                                        context.font = glyphHeight + 'px ' + family;

                                        // The bottom half is saved here.
                                        context.fillText(delimiter, elem.width / 2, 33 - fontTeX.fontDimen.depthOf(delimiter, family) * glyphHeight);
                                        var bottomHalf = context.getImageData(0, 0, elem.width, 33);
                                        context.clearRect(0, 0, elem.width, elem.height);

                                        // Since there's three parts, the top needs to be saved too for the next part (the
                                        // middle) to be drawn too.
                                        context.fillText(delimiter, elem.width / 2, 100 - fontTeX.fontDimen.depthOf(delimiter, family) * glyphHeight)
                                        var topHalf = context.getImageData(0, 0, elem.width, 33);
                                        context.clearRect(0, 0, elem.width, elem.height);

                                        // The middle is drawn here and the top and bottom parts are cleared.
                                        context.fillText(delimiter, elem.width / 2, elem.height / 2 + 50 - fontTeX.fontDimen.depthOf(delimiter, family) * glyphHeight);
                                        context.clearRect(0, 0, elem.width, Math.floor(elem.height / 2) - 17);
                                        context.clearRect(0, Math.ceil(elem.height / 2) + 17, elem.width, elem.height);

                                        context.putImageData(topHalf, 0, 0);
                                        context.putImageData(bottomHalf, 0, elem.height - 33);

                                        if (elem.height > 100) {
                                            // There are two regions that need to be filled in. The top one is done first.
                                            var topRegion = context.createImageData(elem.width, Math.ceil(elem.height / 2) - 50),
                                                topHalfRow = topHalf.data.slice(32 * elem.width * 4, 33 * elem.width * 4),
                                                bottomHalfRow = context.getImageData(0, Math.ceil(elem.height / 2) - 16, elem.width, 1).data;
                                            for (var i = 0, l = topRegion.height / 2; i < l; i++) {
                                                for (var n = 0, j = elem.width; n < j; n++) {
                                                    topRegion.data[i * elem.width * 4 + n * 4] = topHalfRow[n * 4];
                                                    topRegion.data[i * elem.width * 4 + n * 4 + 1] = topHalfRow[n * 4 + 1];
                                                    topRegion.data[i * elem.width * 4 + n * 4 + 2] = topHalfRow[n * 4 + 2];
                                                    topRegion.data[i * elem.width * 4 + n * 4 + 3] = topHalfRow[n * 4 + 3];
                                                    topRegion.data[~~(i + topRegion.height / 2) * elem.width * 4 + n * 4] = bottomHalfRow[n * 4];
                                                    topRegion.data[~~(i + topRegion.height / 2) * elem.width * 4 + n * 4 + 1] = bottomHalfRow[n * 4 + 1];
                                                    topRegion.data[~~(i + topRegion.height / 2) * elem.width * 4 + n * 4 + 2] = bottomHalfRow[n * 4 + 2];
                                                    topRegion.data[~~(i + topRegion.height / 2) * elem.width * 4 + n * 4 + 3] = bottomHalfRow[n * 4 + 3];
                                                }
                                            }
                                            var bottomRegion = context.createImageData(elem.width, Math.ceil(elem.height / 2) - 50),
                                                topHalfRow = context.getImageData(0, Math.floor(elem.height / 2) + 16, elem.width, 1).data,
                                                bottomHalfRow = bottomHalf.data.slice(0, elem.width * 4)
                                            for (var i = 0, l = topRegion.height / 2; i < l; i++) {
                                                for (var n = 0, j = elem.width; n < j; n++) {
                                                    bottomRegion.data[i * elem.width * 4 + n * 4] = topHalfRow[n * 4];
                                                    bottomRegion.data[i * elem.width * 4 + n * 4 + 1] = topHalfRow[n * 4 + 1];
                                                    bottomRegion.data[i * elem.width * 4 + n * 4 + 2] = topHalfRow[n * 4 + 2];
                                                    bottomRegion.data[i * elem.width * 4 + n * 4 + 3] = topHalfRow[n * 4 + 3];
                                                    bottomRegion.data[~~(i + topRegion.height / 2) * elem.width * 4 + n * 4] = bottomHalfRow[n * 4];
                                                    bottomRegion.data[~~(i + topRegion.height / 2) * elem.width * 4 + n * 4 + 1] = bottomHalfRow[n * 4 + 1];
                                                    bottomRegion.data[~~(i + topRegion.height / 2) * elem.width * 4 + n * 4 + 2] = bottomHalfRow[n * 4 + 2];
                                                    bottomRegion.data[~~(i + topRegion.height / 2) * elem.width * 4 + n * 4 + 3] = bottomHalfRow[n * 4 + 3];
                                                }
                                            }
                                            context.putImageData(topRegion, 0, 33);
                                            context.putImageData(bottomRegion, 0, elem.height / 2 + 17);
                                        }

                                        token.div.insertBefore(elem, leftSide ? token.div.firstElementChild : null);
                                        break;
                                }
                            }

                            renderElem(leftDelim, token.delims[0], true);
                            renderElem(rightDelim, token.delims[1], false);
                        }


                        // At this point, a normal atom is done rendering. That includes Ord, Bin, Rel, Op,
                        // etc. There are some special atoms though, like Vcent and Acc. Some atoms are
                        // like Ord atoms but with extra processing. That processing happens here. If the
                        // atom isn't special, this step is skipped.
                        switch (token.atomType) {
                            case 'rad':
                                break;

                            case 'acc':
                                break;

                            case 'vcenter':

                                break;
                        }

                        break;
                }
            }

            // `parse2' places atoms, kerns, and glues into the correct elements so that the
            // overall item is allowed to break lines at the correct places. It doesn't seem
            // like it'd be that complicated, but just look at the markup of rendered TeX.
            // Lots of flex boxes and spacing divs to keep track of.
            function parse2(step, i , l) {
                var token = items[i],
                    atomIndex = atoms.indexOf(token);
                switch (step) {
                    case 1:
                        // Render glues and kerns here.
                        if (token.italicCorrection) token.dimen = new DimenReg(0, fontTeX.fontDimen.italCorrOf(token.italicCorrection, family) * 65536);

                        // This converts vertical glues into vertical kerns since they can't be stretched
                        // or shrunk.
                        if (token.type == 'vglue') {
                            token.type = 'vkern';
                            token.dimen = token.glue.start;
                            delete token.glue;
                        }

                        // Unstretchable/unshrinkable glues are automatically converted to kerns since they
                        // are exactly the same thing. Converting to a kern allows for negative widths
                        // without taking away any functionality.
                        if (token.type == 'glue' && token.glue.start.type == 'dimension' && token.glue.stretch.sp.value == 0 && token.glue.stretch.em.value == 0 && token.glue.shrink.type == 'dimension' && token.glue.shrink.sp.value == 0 && token.glue.shrink.em.value == 0) {
                            token.type = 'kern';
                            token.dimen = token.glue.start;
                        }

                        if (token.type == 'vkern' && (token.dimen.sp.value || token.dimen.em.value)) {
                            // If the token is a vertical kern (or former vertical glue), `verticalOffsets' is
                            // added to so that it'll affect later items.

                            verticalOffsets.sp += token.dimen.sp.value;
                            verticalOffsets.em += token.dimen.em.value;
                            childFlexes.push(document.createElement('div'));
                            childFlexes.last.style.display = 'inline-flex';
                            childFlexes.last.style.flexWrap = 'nowrap';
                            if (verticalOffsets.sp || verticalOffsets.em) {
                                childFlexes.last.style.position = 'relative';
                                childFlexes.last.style.marginTop = verticalOffsets.sp ?
                                    verticalOffsets.em ? 'calc(' + verticalOffsets.sp / 65536 + 'pt + ' + verticalOffsets.em / 65536 + 'em)' :
                                    verticalOffsets.sp / 65536 + 'pt' : verticalOffsets.em / 65536 + 'em';
                                childFlexes.last.style.marginBottom = verticalOffsets.sp ?
                                    verticalOffsets.em ? 'calc(' + -verticalOffsets.sp / 65536 + 'pt - ' + verticalOffsets.em / 65536 + 'em)' :
                                    -verticalOffsets.sp / 65536 + 'pt' : -verticalOffsets.em / 65536 + 'em';
                                childFlexes.last.style.top = verticalOffsets.sp ?
                                    verticalOffsets.em ? 'calc(' + -verticalOffsets.sp / 65536 + 'pt - ' + verticalOffsets.em / 65536 + 'em)' :
                                    -verticalOffsets.sp / 65536 + 'pt' : -verticalOffsets.em / 65536 + 'em';
                            }
                        } else if (token.type == 'kern' && (token.dimen.sp.value || token.dimen.em.value)) {
                            // If the token is a horizontal kern item, it can be added like a regular div with
                            // a set width and no stretchability. Instead of giving it a width, its margin-left
                            // is set instead to allow for negative values (negative widths are ignored). That
                            // lets kerns alter widths in both positive and negative ways.

                            var kern = document.createElement('div');
                            kern.style.marginLeft = token.dimen.sp.value ?
                                token.dimen.em.value ? 'calc(' + token.dimen.sp.value / 65536 + 'pt + ' + token.dimen.em.value / 65536 + 'em)' :
                                token.dimen.sp.value / 65536 + 'pt' : token.dimen.em.value / 65536 + 'em';
                            childFlexes.push(kern);
                            childFlexes.push(document.createElement('div'));
                            childFlexes.last.style.display = 'inline-flex';
                            childFlexes.last.style.flexWrap = 'nowrap';
                            childFlexes.last.style.alignItems = 'baseline';
                            if (verticalOffsets.sp || verticalOffsets.em) {
                                childFlexes.last.style.position = 'relative';
                                childFlexes.last.style.marginTop = verticalOffsets.sp ?
                                    verticalOffsets.em ? 'calc(' + verticalOffsets.sp / 65536 + 'pt + ' + verticalOffsets.em / 65536 + 'em)' :
                                    verticalOffsets.sp / 65536 + 'pt' : verticalOffsets.em / 65536 + 'em';
                                childFlexes.last.style.marginBottom = verticalOffsets.sp ?
                                    verticalOffsets.em ? 'calc(' + -verticalOffsets.sp / 65536 + 'pt - ' + verticalOffsets.em / 65536 + 'em)' :
                                    -verticalOffsets.sp / 65536 + 'pt' : -verticalOffsets.em / 65536 + 'em';
                                childFlexes.last.style.top = verticalOffsets.sp ?
                                    verticalOffsets.em ? 'calc(' + -verticalOffsets.sp / 65536 + 'pt - ' + verticalOffsets.em / 65536 + 'em)' :
                                    -verticalOffsets.sp / 65536 + 'pt' : -verticalOffsets.em / 65536 + 'em';
                            }
                        } else if (token.type == 'glue') {
                            // If it's a horizontal glue item, it acts like a kern item except it's allowed to
                            // stretch and/or shrink. Instead of using margin-left like a glue though, it uses
                            // width. That means glue widths can't be negative, but at least it adds the abil-
                            // ity to stretch and shrink.

                            var glue = document.createElement('div');
                            glue.style.width = token.glue.start.sp.value ?
                                token.glue.start.em.value ? 'calc(' + token.glue.start.sp.value / 65536 + 'pt + ' + token.glue.start.em.value / 65536 + 'em)' :
                                token.glue.start.sp.value / 65536 + 'pt' : token.glue.start.em.value / 65536 + 'em';
                            if (token.glue.stretch.type == 'infinite dimension') {
                                glue.style.flexGrow = Math.pow(1290, token.glue.stretch.magnitude.value);
                            } else if (token.glue.stretch.sp.value || token.glue.stretch.em.value) {
                                glue.style.flexGrow = 1;
                                glue.style.maxWidth = 'calc(' + (token.glue.start.sp.value ?
                                    token.glue.start.em.value ? '(' + token.glue.start.sp.value / 65536 + 'pt + ' + token.glue.start.em.value / 65536 + 'em)' :
                                    token.glue.start.sp.value / 65536 + 'pt' : token.glue.start.em.value / 65536 + 'em') + ' + ' + (token.glue.stretch.sp.value ?
                                    token.glue.stretch.em.value ? '(' + token.glue.stretch.sp.value / 65536 + 'pt + ' + token.glue.stretch.em.value / 65536 + 'em)' :
                                    token.glue.stretch.sp.value / 65536 + 'pt' : token.glue.stretch.em.value / 65536 + 'em') + ')';
                            }
                            if (token.glue.shrink.type == 'infinite dimension') {
                                glue.style.flexShrink = Math.pow(1290, token.glue.shrink.magnitude.value);
                            } else if (token.glue.shrink.sp.value || token.glue.shrink.em.value) {
                                glue.style.flexShrink = 1;
                                glue.style.minWidth = 'calc(' + (token.glue.start.sp.value ?
                                    token.glue.start.em.value ? '(' + token.glue.start.sp.value / 65536 + 'pt + ' + token.glue.start.em.value / 65536 + 'em)' :
                                    token.glue.start.sp.value / 65536 + 'pt' : token.glue.start.em.value / 65536 + 'em') + ' - ' + (token.glue.shrink.sp.value ?
                                    token.glue.shrink.em.value ? '(' + token.glue.shrink.sp.value / 65536 + 'pt + ' + token.glue.shrink.em.value / 65536 + 'em)' :
                                    token.glue.shrink.sp.value / 65536 + 'pt' : token.glue.shrink.em.value / 65536 + 'em') + ')';
                            }
                            childFlexes.push(glue);
                            childFlexes.push(document.createElement('div'));
                            childFlexes.last.style.display = 'inline-flex';
                            childFlexes.last.style.flexWrap = 'nowrap';
                            childFlexes.last.style.alignItems = 'baseline';
                            if (verticalOffsets.sp || verticalOffsets.em) {
                                childFlexes.last.style.position = 'relative';
                                childFlexes.last.style.marginTop = verticalOffsets.sp ?
                                    verticalOffsets.em ? 'calc(' + verticalOffsets.sp / 65536 + 'pt + ' + verticalOffsets.em / 65536 + 'em)' :
                                    verticalOffsets.sp / 65536 + 'pt' : verticalOffsets.em / 65536 + 'em';
                                childFlexes.last.style.marginBottom = verticalOffsets.sp ?
                                    verticalOffsets.em ? 'calc(' + -verticalOffsets.sp / 65536 + 'pt - ' + verticalOffsets.em / 65536 + 'em)' :
                                    -verticalOffsets.sp / 65536 + 'pt' : -verticalOffsets.em / 65536 + 'em';
                                childFlexes.last.style.top = verticalOffsets.sp ?
                                    verticalOffsets.em ? 'calc(' + -verticalOffsets.sp / 65536 + 'pt - ' + verticalOffsets.em / 65536 + 'em)' :
                                    -verticalOffsets.sp / 65536 + 'pt' : -verticalOffsets.em / 65536 + 'em';
                            }
                        }

                        parse2(2, i, l);
                        break;

                    case 2:
                        // Render atoms here.
                        if (token.type == 'atom') {
                            // If the current atom is a Bin, Rel, or Punct atom, then a new flex box needs to
                            // be created to allow for line breaks. A line break can happen before a Bin or Rel
                            // atom, or after a Punct atom. The Punct case is handled after it's already been
                            // added to the current flex box (towards the end of this `case').
                            if (atomIndex != 0 && token.atomType == 2) {
                                if (style == 'display' || style == 'text') {
                                    childFlexes.push(document.createElement('div'));
                                    childFlexes.last.style.flexShrink = 1;
                                    childFlexes.last.style.flexGrow = 1;
                                    childFlexes.last.style.maxWidth = '.3333333em';
                                    childFlexes.last.style.width = '.2222222em';
                                }
                                childFlexes.push(document.createElement('div'));
                                childFlexes.last.style.display = 'inline-flex';
                                childFlexes.last.style.flexWrap = 'nowrap';
                                childFlexes.last.style.alignItems = 'baseline';
                                if (verticalOffsets.sp || verticalOffsets.em) {
                                    childFlexes.last.style.position = 'relative';
                                    childFlexes.last.style.marginTop = verticalOffsets.sp ?
                                        verticalOffsets.em ? 'calc(' + verticalOffsets.sp / 65536 + 'pt + ' + verticalOffsets.em / 65536 + 'em)' :
                                        verticalOffsets.sp / 65536 + 'pt' : verticalOffsets.em / 65536 + 'em';
                                    childFlexes.last.style.marginBottom = verticalOffsets.sp ?
                                        verticalOffsets.em ? 'calc(' + -verticalOffsets.sp / 65536 + 'pt - ' + verticalOffsets.em / 65536 + 'em)' :
                                        -verticalOffsets.sp / 65536 + 'pt' : -verticalOffsets.em / 65536 + 'em';
                                    childFlexes.last.style.top = verticalOffsets.sp ?
                                        verticalOffsets.em ? 'calc(' + -verticalOffsets.sp / 65536 + 'pt - ' + verticalOffsets.em / 65536 + 'em)' :
                                        -verticalOffsets.sp / 65536 + 'pt' : -verticalOffsets.em / 65536 + 'em';
                                }

                            }
                            if (atomIndex != 0 && token.atomType == 3) {
                                if (style == 'display' || style == 'text' && atoms[atomIndex - 1].atomType != 3 && atoms[atomIndex - 1].atomType != 4) {
                                    childFlexes.push(document.createElement('div'));
                                    if (atoms[atomIndex - 1].atomType == 6) childFlexes.last.style.width = '.1666667em';
                                    else {
                                        childFlexes.last.style.flexGrow = 1;
                                        childFlexes.last.style.maxWidth = '.5555555em';
                                        childFlexes.last.style.width = '.2777778em';
                                    }
                                }
                                childFlexes.push(document.createElement('div'));
                                childFlexes.last.style.display = 'inline-flex';
                                childFlexes.last.style.flexWrap = 'nowrap';
                                childFlexes.last.style.alignItems = 'baseline';
                                if (verticalOffsets.sp || verticalOffsets.em) {
                                    childFlexes.last.style.position = 'relative';
                                    childFlexes.last.style.marginTop = verticalOffsets.sp ?
                                        verticalOffsets.em ? 'calc(' + verticalOffsets.sp / 65536 + 'pt + ' + verticalOffsets.em / 65536 + 'em)' :
                                        verticalOffsets.sp / 65536 + 'pt' : verticalOffsets.em / 65536 + 'em';
                                    childFlexes.last.style.marginBottom = verticalOffsets.sp ?
                                        verticalOffsets.em ? 'calc(' + -verticalOffsets.sp / 65536 + 'pt - ' + verticalOffsets.em / 65536 + 'em)' :
                                        -verticalOffsets.sp / 65536 + 'pt' : -verticalOffsets.em / 65536 + 'em';
                                    childFlexes.last.style.top = verticalOffsets.sp ?
                                        verticalOffsets.em ? 'calc(' + -verticalOffsets.sp / 65536 + 'pt - ' + verticalOffsets.em / 65536 + 'em)' :
                                        -verticalOffsets.sp / 65536 + 'pt' : -verticalOffsets.em / 65536 + 'em';
                                }
                            }

                            // If the atom is an actual line break item (from "\\"), it should make a new flex
                            // box child just like with a Rel or Bin atom.
                            if (atomIndex != 0) {
                                // If an atom precedes the current one, a glue item is inserted just like in plain
                                // TeX. The inter-atom glue chart was taken from page 170 of the TeXbook. For a few
                                // atom combinations, they have been set to 0 because they're handled elsewhere
                                // above for Bin or Rel and below for Punct).
                                var left = atoms[atomIndex - 1].atomType,
                                    right = token.atomType,
                                    spacing = ({
                                        0: {0:  0, 1:  1, 2:  0, 3:  0, 4:  0, 5:  0, 6:  0, 7:  0, inner: -1},
                                        1: {0:  1, 1:  1,        3:  0, 4:  0, 5:  0, 6:  0, 7:  1, inner: -1},
                                        2: {0: -2, 1: -2,               4: -2,               7: -2, inner: -2},
                                        3: {0: -3, 1: -3,        3:  0, 4: -3, 5:  0, 6:  0, 7: -3, inner: -3},
                                        4: {0:  0, 1:  0,        3:  0, 4:  0, 5:  0, 6:  0, 7:  0, inner:  0},
                                        5: {0:  0, 1:  1, 2:  0, 3:  0, 4:  0, 5:  0, 6:  0, 7:  0, inner: -1},
                                        6: {0:  0, 1:  0,        3:  0, 4:  0, 5:  0, 6:  0, 7:  0, inner:  0},
                                        7: {0:  0, 1:  1, 2:  0, 3:  0, 4:  0, 5:  0, 6:  0, 7:  0, inner: -1},
                                    inner: {0: -1, 1:  1, 2:  0, 3:  0, 4: -1, 5:  0, 6: -1, 7: -1, inner: -1}
                                    })[left][right],
                                    space = document.createElement('div');
                                if (spacing < 0) {
                                    if (token.style == 'script' || token.style == 'scriptscript') spacing = 0;
                                    else spacing = -spacing;
                                }
                                switch (spacing) {
                                    case 1:
                                        space.style.width = '.1666667em';
                                        break;

                                    case 2:
                                        space.style.width = '.2222222em';
                                        space.style.maxWidth = '.3333333em';
                                        space.style.flexGrow = '1';
                                        space.style.flexShrink = '1';
                                        break;

                                    case 3:
                                        space.style.width = '.2777778em';
                                        space.style.maxWidth = '.5555555em';
                                        space.style.flexGrow = '1';
                                        break;
                                }
                                if (spacing) childFlexes.last.appendChild(space);
                            }
                            childFlexes.last.renderedHeight = Math.max(childFlexes.last.renderedHeight || 0, token.div.renderedHeight);
                            childFlexes.last.renderedDepth = Math.max(childFlexes.last.renderedDepth || 0, token.div.renderedDepth);
                            if (token.isLineBreak) {
                                childFlexes.push(token.div);
                                childFlexes.push(document.createElement('div'));
                                childFlexes.last.style.display = 'inline-flex';
                                childFlexes.last.style.flexWrap = 'nowrap';
                                childFlexes.last.style.alignItems = 'baseline';
                                if (verticalOffsets.sp || verticalOffsets.em) {
                                    childFlexes.last.style.position = 'relative';
                                    childFlexes.last.style.marginTop = verticalOffsets.sp ?
                                        verticalOffsets.em ? 'calc(' + verticalOffsets.sp / 65536 + 'pt + ' + verticalOffsets.em / 65536 + 'em)' :
                                        verticalOffsets.sp / 65536 + 'pt' : verticalOffsets.em / 65536 + 'em';
                                    childFlexes.last.style.marginBottom = verticalOffsets.sp ?
                                        verticalOffsets.em ? 'calc(' + -verticalOffsets.sp / 65536 + 'pt - ' + verticalOffsets.em / 65536 + 'em)' :
                                        -verticalOffsets.sp / 65536 + 'pt' : -verticalOffsets.em / 65536 + 'em';
                                    childFlexes.last.style.top = verticalOffsets.sp ?
                                        verticalOffsets.em ? 'calc(' + -verticalOffsets.sp / 65536 + 'pt - ' + verticalOffsets.em / 65536 + 'em)' :
                                        -verticalOffsets.sp / 65536 + 'pt' : -verticalOffsets.em / 65536 + 'em';
                                }
                            } else {
                                childFlexes.last.appendChild(token.div);
                            }

                            // This is where Punct line breaks are handled.
                            if (token.atomType == 6) {
                                if (style == 'display' || style == 'text' && (!atoms[atomIndex + 1] || atoms[atomIndex + 1].atomType != 3)) {
                                    childFlexes.push(document.createElement('div'));
                                    childFlexes.last.style.width = '.1666667em';
                                }
                                childFlexes.push(document.createElement('div'));
                                childFlexes.last.style.display = 'inline-flex';
                                childFlexes.last.style.flexWrap = 'nowrap';
                                childFlexes.last.style.alignItems = 'baseline';
                                if (verticalOffsets.sp || verticalOffsets.em) {
                                    childFlexes.last.style.position = 'relative';
                                    childFlexes.last.style.marginTop = verticalOffsets.sp ?
                                        verticalOffsets.em ? 'calc(' + verticalOffsets.sp / 65536 + 'pt + ' + verticalOffsets.em / 65536 + 'em)' :
                                        verticalOffsets.sp / 65536 + 'pt' : verticalOffsets.em / 65536 + 'em';
                                    childFlexes.last.style.marginBottom = verticalOffsets.sp ?
                                        verticalOffsets.em ? 'calc(' + -verticalOffsets.sp / 65536 + 'pt - ' + verticalOffsets.em / 65536 + 'em)' :
                                        -verticalOffsets.sp / 65536 + 'pt' : -verticalOffsets.em / 65536 + 'em';
                                    childFlexes.last.style.top = verticalOffsets.sp ?
                                        verticalOffsets.em ? 'calc(' + -verticalOffsets.sp / 65536 + 'pt - ' + verticalOffsets.em / 65536 + 'em)' :
                                        -verticalOffsets.sp / 65536 + 'pt' : -verticalOffsets.em / 65536 + 'em';
                                }
                            }
                        }
                        break;
                }
            }

            for (var i = 0, l = childFlexes.length; i < l; i++) {
                flex.appendChild(childFlexes[i]);
                flex.renderedHeight = Math.max(flex.renderedHeight || 0, childFlexes[i].renderedHeight || 0);
                flex.renderedDepth = Math.max(flex.renderedDepth || 0, childFlexes[i].renderedDepth || 0);
            }

            parent.appendChild(flex);
            parent.renderedHeight = Math.max(parent.renderedHeight || 0, flex.renderedHeight);
            parent.renderedDepth = Math.max(parent.renderedDepth || 0, flex.renderedDepth);

            return lastChar;
        }

        return div;








/*
        // `family' is the font-family of the `parent' element. It's used when getting the
        // widths of characters.
        var family = parent.style.fontFamily || getComputedStyle(parent).fontFamily;
        // `body' is the overall containing element. It will be returned after everything
        // has been parsed and added to the list.
        var body = document.createElement('div');
        body.style.display = 'inline-block';
        body.style.lineHeight = 1.2;
        // The `relWidth' property is a number that keeps track of the relative width in em
        // units that the list takes up. The width of individual characters are taken and
        // added together. The relative width lets lists' widths be compared so that the
        // thinnest one can be altered and made to match the width of the fattest list. It
        // is especially helpful in fractions and stacked superscripts and subscripts.
        body.relWidth = 0;

        // Each token is iterated over and added to the containing <div>.
        for (var i = 0, l = tokens.length; i < l; i++) {
            var token = tokens[i];
            if (token.type == 'atom') {
                // `atom' will be a <div> that has the nucleus along with the superscripts and sub-
                // scripts.
                var atom = document.createElement('div');
                atom.style.display = 'inline-block';

                if (Array.isArray(token.nucleus)) {
                    // If the nucleus is a token list in itself, it is parsed separately and added to
                    // the atom all in one.
                    var nucleus = fontTeX._genHTML(token.nucleus, style, 'normal', family);
                    atom.appendChild(nucleus);
                } else if (token.nucleus) {
                    // If the nucleus is just a single character, it is added to the atom by itself
                    // without wrapping it in its own list.
                    body.relWidth += fontTeX.fontDimen.widthOf(token.nucleus.char, family);
                    if (token.nucleus.invalid) {
                        var div = document.createElement('div');
                        div.style.display = 'inline-block';
                        div.style.background = '#c00';
                        div.style.color = '#fff';
                        div.innerText = token.nucleus.char;
                        atom.appendChild(div);
                    } else atom.appendChild(document.createTextNode(token.nucleus.char));
                }

                // There are four cases with superscripts and subscripts: 1) there are none (just
                // a regular character), 2) there is only a superscript, 3) there is only a sub-
                // script, and 4) there is both a superscript and subscript. In the first case, no-
                // thing needs to be done; the atom is already done being created. The other three
                // cases are below.
                if (token.superscript && !token.subscript) {
                    // There is only a superscript. A superscript is always aligned such that its bot-
                    // tom is right in the middle of the line. To do that is pretty simple: two elem-
                    // ents are added to the atom. The first one will be a `display' element. It will
                    // contain the visible text that the user sees. The other will be a `spacing' elem-
                    // ent. It will be completely blank and will offset any neighboring elements so
                    // that they don't overlap on top of the `display' element. The `display' element
                    // will have a height and width of 0, hence the need for a `spacing' element.

                    // First, the `display' element is created. It will have no height or width.
                    var display = document.createElement('div');
                    display.style.verticalAlign = 'middle';
                    display.style.display = 'inline-block';
                    display.style.position = 'relative';
                    // Now, an element is made that will be inside the `display' atom. It will be abs-
                    // olutly positioned so that it doesn't add any dimension to its parent. It will
                    // have bottom: 0 so that its bottom will be aligned with the bottom of the `dis-
                    // play' atom (i.e. right above the middle of the line).
                    var superscript = fontTeX._genHTML(Array.isArray(token.superscript) ? token.superscript : [token.superscript], style == 'display' || style == 'text' ? 'script' : 'scriptscript', family);
                    superscript.style.position = 'absolute';
                    superscript.style.bottom = '0';
                    body.relWidth += (superscript.relWidth *= (style == 'display' || style == 'text' ? .7 : style == 'script' ? 5/7 : 1));
                    display.appendChild(superscript);
                    // Now that's done, the `spacing' element has to be added too. We already know the
                    // relative width of the element in em units, but the height is still needed to
                    // offset the line above.
                    var spacing = document.createElement('div');
                    spacing.style.width = superscript.relWidth + 'em';
                    spacing.style.height = fontTeX._relHeightOf(display, parent) * superscript.relWidth + 'em';
                    display.style.
                    // Now add the two element to the overall atom element.
                    atom.appendChild(display);
                    atom.appendChild(spacing);
                } else if (token.subscript && !token.superscript) {
                    // If the atom has a subscript without a superscript, the subscript is rendered a
                    // little bit higher since there's nothing to block it from going up.
                    var subscript = fontTeX._genHTML(Array.isArray(token.subscript) ? token.subscript : [token.subscript], style == 'display' || style == 'text' ? 'script' : 'scriptscript', family);
                    subscript.style.marginBottom = '.15em';
                    subscript.style.position = 'relative';
                    subscript.style.top = '.15em';
                    body.relWidth += subscript.relWidth;
                    atom.appendChild(subscript);
                }
                body.appendChild(atom);
        }*/
        return body;
    }



    // These constructors are used in the JSON object below.

    // The Primitive class is used in the declaration of TeX primitives. In normal TeX,
    // these can overridden, but since they're used by some code here, they can't be.
    // Commands that have been \let to be set to a primitive CAN be overridden though
    // since they are just macros with the behavior of a primitive. The `func' argument
    // is the function that is run whenever the primitive is encountered and need to be
    // evaluated.
    function Primitive(name, func) {
        this.name = name;
        this.type = 'primitive';
        this.function = func;
    }

    // The Macro class is used for user-defined macros. Normally, these are just expan-
    // ded into an already-parsed list of tokens, but it can also be a reference to a
    // primitive command. In that case, the primitive command is executed. If a Macro
    // or Primitive object is passed as an argument, the Macro gets a `proxy' property
    // that just means that it is a reference to another macro. Whenever the proxy mac-
    // ro needs to be evaluated, the macro's reference is evaluated. That proxy behavi-
    // or allows for keeping track of macros that have been defined using \let. When
    // \let is used on a single token (e.g. \let\amp=&) (the command needs to inherit
    // the token's character and catcode), a 'macro' is made that consists only of that
    // one token and passed into the constructor. That way, it will expand to that sin-
    // gle token and still be considered a proxy macro. There's a difference though be-
    // tween \let-ting to a primitive\character and \let-ting to a macro that only ref-
    // rences the primitive\macro. For example, \def\macro{\let} \let\cmdone=\let
    // \let\cmdtwo=\macro. In both cases, \let is eventually used as the command, but
    // \cmdone is a direct reference to \let, but \cmdtwo is a reference to a reference
    // to \let. That distinction is made with the second argument. If it's `true' (and
    // the first argument is a macro/primitive), then it means it's a direct reference.
    // Otherwise, it's just a reference to a macro.
    function Macro(replacementTokens, parameterTokens) {
        this.type = 'macro';
        if (replacementTokens instanceof Primitive || replacementTokens instanceof Macro) {
            if (replacementTokens.proxy) replacementTokens = replacementTokens.original;
            this.proxy = true;
            this.isLet = !!parameterTokens;
            this.original = replacementTokens;
        } else {
            this.proxy = false;
            this.replacement = replacementTokens || [];
            this.parameters = parameterTokens || [];
        }
    }

    // The IntegerReg class is used for integer registers (\count). It holds values
    // between [-(2^53 - 1), 2^53 - 1] or [-9007199254740991, 9007199254740991]. Dec-
    // imal and fraction values are rounded off.
    function IntegerReg(int, msg) {
        this.type = 'integer';
        this.register = true;
        this.message = msg || '';
        if (int instanceof IntegerReg) {
            this.value = int.value;
            this.parent = int;
        } else {
            int = Math.round(int);
            if (!isFinite(int)) int = 9007199254740991 * Math.sign(int);
            if (int > 9007199254740991) int = -9007199254740991 + (int % 9007199254740991);
            else if (int < -9007199254740991) int = 9007199254740991 + (int % 9007199254740991);
            this.value = isNaN(int) ? 0 : Math.round(int);
        }
    }

    // The DimenReg class is used for dimension registers (\dimen). It hold values bet-
    // ween (-137438953472 pt, 137438953472 pt) (since they are stores as scaled
    // points, which are 1/65536 of a pt). They are also capable of storing em values,
    // so they can technically hold more than 137438953472 pt since the two are stored
    // as separate numbers. Em values are stored as "scaled" em units. 1 em is stored
    // as 65536. This applies to MuDimenReg and both types of dimension registers.
    function DimenReg(sp, em, msg) {
        this.type = 'dimension';
        this.message = msg || '';
        this.register = true;
        if (sp instanceof DimenReg) {
            this.sp = new IntegerReg(sp.sp);
            this.em = new IntegerReg(sp.em);
            this.message = em || '';
            this.parent = sp;
        } else if (sp instanceof MuDimenReg) {
            this.sp = new IntegerReg(0);
            this.em = new IntegerReg(sp.mu / 18);
            this.message = em || '';
        } else {
            this.sp = new IntegerReg(sp);
            this.em = new IntegerReg(em);
        }
    }

    // The MuDimenReg class is exactly like the DimenReg class except that all units
    // measured in terms of math units (18mu = 1em). There is no sp or em value, just
    // a mu value.
    function MuDimenReg(mu, msg) {
        this.type = 'mu dimension';
        this.message = msg || '';
        this.register = true;
        if (mu instanceof MuDimenReg) {
            this.mu = new IntegerReg(mu.mu);
            this.parent = mu;
        } else if (mu instanceof DimenReg) this.mu = new IntegerReg(mu.em / 18 + mu.sp / 65536 / 12 * 18);
        else this.mu = new IntegerReg(mu);
    }

    // The GlueReg class is used for glue registers (\skip). They are basically three
    // DimenReg objects in one. They can also hold infinite values though for their
    // stretch and shrink values. There are three magnitudes of infinities (fil, fill,
    // and filll). These are stores as InfDimen objects.
    function GlueReg(start, stretch, shrink, msg) {
        this.type = 'glue';
        this.message = msg || '';
        this.register = true;
        if (start instanceof GlueReg) {
            this.start = new DimenReg(start.start);
            this.stretch = new DimenReg(start.stretch);
            this.shrink = new DimenReg(start.shrink);
            this.parent = start;
        } else {
            this.start = new DimenReg(start);
            this.stretch = stretch instanceof InfDimen ? stretch : new DimenReg(stretch);
            this.shrink = shrink instanceof InfDimen ? shrink : new DimenReg(shrink);
        }
    }

    // The MuGlueReg class is exactly the same as the GlueReg class except that it only
    // keeps track of units in terms of math units (18mu = 1em).
    function MuGlueReg(start, stretch, shrink, msg) {
        this.type = 'mu glue';
        this.message = msg || '';
        this.register = true;
        if (start instanceof MuGlueReg) {
            this.start = new MuDimenReg(start.start);
            this.stretch = new MuDimenReg(start.stretch);
            this.shrink = new MuDimenReg(start.shrink);
            this.parent = start;
        } else {
            this.start = new MuDimenReg(start);
            this.stretch = stretch instanceof InfDimen ? stretch : new MuDimenReg(stretch);
            this.shrink = shrink instanceof InfDimen ? shrink : new MuDimenReg(shrink);
        }
    }

    // This is a kind-of dimension used for GlueReg objects. They represent fil, fill,
    // and filll objects. `num' is the number of infinities, `mag' is the magnitude.
    // 1fil < 100fil < 1fill < 100fill < 1filll < 100filll.
    function InfDimen(num, mag, msg) {
        this.type = 'infinite dimension';
        this.message = msg || '';
        this.register = true;
        this.number = new IntegerReg(num);
        this.magnitude = new IntegerReg(mag);
    }


    // The `data' object defined below is where a lot of the data pertaining to TeX is
    // stored. In it are stuff like globally-defined macros, primitive commands, the
    // catcode table, uppercase and lowercase conversions, etc. This object gets cloned
    // for each <font-tex> element, since definitions made inside each one shouldn't
    // affect definitions made in others (unless the definition is preceded by \global).
    // That clone is also in turn cloned whenever a new group is opened (typically with
    // "{" and "}" delimiters) since definitions are also local only to that group.
    var data = {
        defs: {
            primitive: {
                // This is where TeX's primitive commands are stored. Each key name is the name of
                // the command. Each key's value is a Primitive object that stores the function to
                // be executed each time the primitive needs to be evaluated. The function gets one
                // argument when called that contains all the data and functions necessary for the
                // function to perform its action.
                '/': new Primitive('/', function(e) {
                    // The \/ command is an italic correction. Right now, a basic kern is added that's
                    // marked with an italicCorrection tag. Later, when kerns and glues are being eval-
                    // uated, the kern's actual width will be determined based on the last character.
                    // In plain TeX, italic correction information comes with the font's parameters. In
                    // this version, an italic correction has to be determined (that's done in the
                    // `fontTeX.fontDimen.italCorrOf' function).

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    e.tokens.push({
                        type: 'kern',
                        dimen: new DimenReg(0),
                        italicCorrection: true
                    });
                    return [];
                }),
                above: new Primitive('above', function(e) {
                    // \above creates fraction tokens. All the tokens in the current scope up to the
                    // \above are used as the numerator and all the tokens after it are used as the
                    // denominator. \above takes one dimension argument that sets the width of the
                    // fraction bar. There is also \abovewithdelims, \atop, \atopwithdelims, \over,
                    // and \overwithdelims.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    // First, the dimension token has to be eaten.
                    var dimen = e.mouth.eat('dimension');
                    if (!dimen) {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    // Mark the last scope as a fraction.
                    e.scopes.last.isFrac = true;

                    // Every fraction has delimiters corresponding to their \bigg size (for when in
                    // \displaystyle) or \big size (for when in \textstyle) or regular size (for when
                    // in \scriptstyle or \scriptstylestyle).
                    e.scopes.last.fracRightDelim = e.scopes.last.fracRightDelim = '.'

                    e.scopes.last.barWidth = dimen;

                    e.scopes.last.fracNumerator = e.scopes.last.tokens;
                    e.scopes.last.tokens = [];

                    return [];
                }),
                abovewithdelims: new Primitive('abovewithdelims', function(e) {
                    // \abovewithdelims works like the regular \above except a pair of delimiters go
                    // around the fraction. The delimiters are like the \left\right ones except their
                    // size is determined by the current style, not the height of the fraction.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var aboveDelimsSym = Symbol();
                    e.mouth.saveState(aboveDelimsSym);

                    var dimen = e.mouth.eat('dimension');
                    if (!dimen) {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }


                    // Now the delimiters need to be looked for. Macros are expanded here the way \left
                    // expands macros to look for delimiters.
                    while (true) {
                        var token = e.mouth.eat();

                        if (token && (token.type == 'command' || token.type == 'character' && token.cat == data.cats.active)) {
                            var expansion = e.mouth.expand(token, e.mouth);

                            e.mouth.queue.unshift.apply(e.mouth.queue, expansion);
                        } else if (token && token.type == 'character' && data.delims.includes(token.code) && (token.cat == data.cats.all || token.cat == data.cats.letter)) {
                            if (e.scopes.last.fracLeftDelim) {
                                e.scopes.last.fracRightDelim = token.char;
                                break;
                            } else {
                                e.scopes.last.fracLeftDelim = token.char;
                            }
                        } else {
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(aboveDelimsSym);
                            delete e.scopes.last.fracLeftDelim;
                            return [this];
                        }
                    }

                    e.scopes.last.isFrac = true;

                    e.scopes.last.barWidth = dimen;

                    e.scopes.last.fracNumerator = e.scopes.last.tokens;
                    e.scopes.last.tokens = [];

                    return [];
                }),
                accent: new Primitive('accent', function(e) {
                    // \accent takes an integer argument and accents the next atom with the character
                    // with the charCode of the number specified. This is mostly used for macros, like
                    // \~ (displays a tilde over the next atom). Technically though, any character can
                    // be an accent over any character. You could for example accent a an "A" with an
                    // "a" accent. It'll look stupid and ugly, but you still could.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var accentSym = Symbol();
                    e.mouth.saveState(accentSym);
                    var charCode = e.mouth.eat('integer');
                    if (!charCode || charCode.value < 0) {
                        this.invalid = true;
                        this.recognized = true;
                        e.mouth.loadState(accentSym);
                        return [this];
                    }
                    // Instead of adding an Acc atom to the tokens list, a temporary token is added in-
                    // stead. At the end of the whole tokenization process, the temporary token is ap-
                    // plied to the next atom's nucleus. If the next token isn't an atom, then the
                    // command is rendered invalid.
                    e.tokens.push({
                        type: 'accent modifier',
                        char: String.fromCharCode(charCode.value),
                        code: charCode.value,
                        token: this
                    });
                    return [];
                }),
                advance: new Primitive('advance', function(e) {
                    // \advance advances (adds to) a register by a specified value.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var advanceSym = Symbol();
                    e.mouth.saveState(advanceSym);

                    while (true) {
                        var register = e.mouth.eat();

                        if (register && (register.type == 'command' || register.type == 'character' && register.cat == data.cats.active)) {
                            var expansion = e.mouth.expand(register, e.mouth);

                            e.mouth.queue.unshift.apply(e.mouth.queue, expansion);
                        } else if (register && register.register) {
                            var token = e.mouth.eat();

                            if (token && token.type == 'character' && (token.char == 'b' || token.char == 'B') && token.cat != data.cats.active) {
                                var y = e.mouth.eat();
                                if (!(y && y.type == 'character' && (y.char == 'y' || y.char == 'Y') && y.cat != data.cats.active)) e.mouth.revert(2);
                            } else if (token) e.mouth.revert();
                            else {
                                this.invalid = true;
                                this.recognized = true;
                                e.mouth.loadState(advanceSym);
                                return [this];
                            }

                            if (register.type == 'integer') {
                                var token = e.mouth.eat('integer');

                                if (token) {
                                    register.value += token.value;
                                    var reg = register;
                                    // If an \advance is \global, then all the registers in the enclosing scopes are
                                    // also changed. Instead of just advancing their individual values however, they
                                    // are all set to the value of the register in the current scopes. Consider this:
                                    // \count0=5 {\count0=10 \global\advance\count0 by 10}
                                    // In the outer scope, \count0 is set to 5. In the inner scope, \count0 is set to
                                    // 10, which doesn't affect \count0's value in the outer scope (i.e. after the
                                    // groups is closed, \count0 should still be 5). The \global\advance command how-
                                    // ever is advancing the inner \count0's value by 10. 10 + 10 = 20 so \count0 in
                                    // the inner scope should now have a value of 20. But what about the outer \count0
                                    // though? Should its value be 15 or 20? \advance only works on the innermost reg-
                                    // ister. Even if its \global, it doesn't advance each enclosing \count0 by 10; in-
                                    // stead, it sets them all to the advanced register's value, in this case 20. So
                                    // even though the outer \count0 should be 5 + 10 = 15, its value is being changed
                                    // to 20 because of the \count0 in the inner scope. This is the behavior regular
                                    // TeX uses, so that's what's being followed. This rule applies to \multiply and
                                    // divide as well.
                                    if (e.toggles.global && e.scopes.last.registers.named.globaldefs.value >= 0 || e.scopes.last.registers.named.globaldefs.value > 0) {
                                        while (register.parent) {
                                            register = register.parent;
                                            register.value = reg.value;
                                        }
                                    }
                                    e.toggles.global = false;
                                } else {
                                    this.invalid = true;
                                    this.recognized = true;
                                    e.mouth.loadState(advanceSym);
                                    return [this];
                                }
                            } else if (register.type == 'dimension') {
                                var token = e.mouth.eat('dimension');

                                if (token) {
                                    register.sp.value += token.sp.value;
                                    register.em.value += token.em.value;
                                    var reg = register;
                                    if (e.toggles.global && e.scopes.last.registers.named.globaldefs.value >= 0 || e.scopes.last.registers.named.globaldefs.value > 0) {
                                        while (register.parent) {
                                            register = register.parent;
                                            register.sp.value = reg.sp.value;
                                            register.em.value = reg.em.value;
                                        }
                                    }
                                    e.toggles.global = false;
                                } else {
                                    this.invalid = true;
                                    this.recognized = true;
                                    e.mouth.loadState(advanceSym);
                                    return [this];
                                }
                            } else if (register.type == 'mu dimension') {
                                var token = e.mouth.eat('mu dimension');

                                if (token) {
                                    register.mu.value += token.mu.value;
                                    var reg = register;
                                    if (e.toggles.global && e.scopes.last.registers.named.globaldefs.value >= 0 || e.scopes.last.registers.named.globaldefs.value > 0) {
                                        while (register.parent) {
                                            register = register.parent;
                                            register.mu.value = reg.mu.value;
                                        }
                                    }
                                    e.toggles.global = false;
                                } else {
                                    this.invalid = true;
                                    this.recognized = true;
                                    e.mouth.loadState(advanceSym);
                                    return [this];
                                }
                            } else if (register.type == 'glue') {
                                var token = e.mouth.eat('glue');

                                if (token) {
                                    register.start.sp.value += token.start.sp.value;
                                    register.start.em.value += token.start.em.value;
                                    if (token.stretch.type == 'infinite dimension') {
                                        if (register.stretch.type == 'infinite dimension' && register.stretch.magnitude.value == token.stretch.magnitude.value) {
                                            register.stretch.value += token.stretch.value;
                                        } else if (register.stretch.type != 'infinite dimension' || register.stretch.magnitude.value < token.stretch.magnitude.value) {
                                            register.stretch = new InfDimen(token.stretch.number.value, token.stretch.magnitude.value);
                                        }
                                    } else if (register.stretch.type != 'infinite dimension') {
                                        register.stretch.sp.value += token.stretch.sp.value;
                                        register.stretch.em.value += token.stretch.em.value;
                                    }
                                    if (token.shrink.type == 'infinite dimension') {
                                        if (register.shrink.type == 'infinite dimension' && register.shrink.magnitude.value == token.shrink.magnitude.value) {
                                            register.shrink.value += token.shrink.value;
                                        } else if (register.shrink.type != 'infinite dimension' || register.shrink.magnitude.value < token.shrink.magnitude.value) {
                                            register.shrink = new InfDimen(token.shrink.number.value, token.shrink.magnitude.value);
                                        }
                                    } else if (register.shrink.type != 'infinite dimension') {
                                        register.shrink.sp.value += token.shrink.sp.value;
                                        register.shrink.em.value += token.shrink.em.value;
                                    }
                                    var reg = register;
                                    if (e.toggles.global && e.scopes.last.registers.named.globaldefs.value >= 0 || e.scopes.last.registers.named.globaldefs.value > 0) {
                                        while (register.parent) {
                                            register = register.parent;
                                            register.start.sp.value += token.start.sp.value;
                                            register.start.em.value += token.start.em.value;
                                            if (reg.stretch.type == 'infinite dimension') register.stretch = new InfDimen(reg.stretch.number.value, reg.stretch.magnitude.value);
                                            else register.stretch = new DimenReg(reg.stretch.sp.value, reg.stretch.em.value);
                                            if (reg.shrink.type == 'infinite dimension') register.shrink = new InfDimen(reg.shrink.number.value, reg.shrink.magnitude.value);
                                            else register.shrink = new DimenReg(reg.shrink.sp.value, reg.shrink.em.value);
                                        }
                                    }
                                    e.toggles.global = false;
                                } else {
                                    this.invalid = true;
                                    this.recognized = true;
                                    e.mouth.loadState(advanceSym);
                                    return [this];
                                }
                            } else if (register.type == 'mu glue') {
                                var token = e.mouth.eat('mu glue');

                                if (token) {
                                    register.start.mu.value += token.start.mu.value;
                                    if (token.stretch.type == 'infinite dimension') {
                                        if (register.stretch.type == 'infinite dimension' && register.stretch.magnitude.value == token.stretch.magnitude.value) {
                                            register.stretch.value += token.stretch.value;
                                        } else if (register.stretch.type != 'infinite dimension' || register.stretch.magnitude.value < token.stretch.magnitude.value) {
                                            register.stretch = new InfDimen(token.stretch.number.value, token.stretch.magnitude.value);
                                        }
                                    } else if (register.stretch.type != 'infinite dimension') register.stretch.mu.value += token.stretch.mu.value;
                                    if (token.shrink.type == 'infinite dimension') {
                                        if (register.shrink.type == 'infinite dimension' && register.shrink.magnitude.value == token.shrink.magnitude.value) {
                                            register.shrink.value += token.shrink.value;
                                        } else if (register.shrink.type != 'infinite dimension' || register.shrink.magnitude.value < token.shrink.magnitude.value) {
                                            register.shrink = new InfDimen(token.shrink.number.value, token.shrink.magnitude.value);
                                        }
                                    } else if (register.shrink.type != 'infinite dimension') register.shrink.mu.value += token.shrink.mu.value;
                                    var reg = register;
                                    if (e.toggles.global && e.scopes.last.registers.named.globaldefs.value >= 0 || e.scopes.last.registers.named.globaldefs.value > 0) {
                                        while (register.parent) {
                                            register = register.parent;
                                            register.start.mu.value = reg.start.mu.value;
                                            if (reg.stretch.type == 'infinite dimension') register.stretch = new InfDimen(reg.stretch.number.value, reg.stretch.magnitude.value);
                                            else register.stretch = new MuDimenReg(reg.stretch.mu.value);
                                            if (reg.shrink.type == 'infinite dimension') register.shrink = new InfDimen(reg.shrink.number.value, reg.shrink.magnitude.value);
                                            else register.stretch = new MuDimenReg(reg.shrink.mu.value);
                                        }
                                    }
                                    e.toggles.global = false;
                                } else {
                                    this.invalid = true;
                                    this.recognized = true;
                                    e.mouth.loadState(advanceSym);
                                    return [this];
                                }
                            }
                            break;
                        } else {
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(advanceSym);
                            return [this];
                        }
                    }
                    return [];
                }),
                atop: new Primitive('atop', function(e) {
                    // \atop is exactly equivalent "\above0pt". Basically, the fraction bar is always
                    // 0pt high, which means it's invisible altogether and the numerator and denominat-
                    // or are right over each other with nothing in between.
                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    // Mark the last scope as a fraction.
                    e.scopes.last.isFrac = true;

                    // Every fraction has delimiters that act like \left and \right delimiters. In the
                    // case of \above, it has empty delimiters, which are just period tokens. You can
                    // use \abovewithdelims to change the delimiters.
                    e.scopes.last.fracLeftDelim = e.scopes.last.fracRightDelim = '.'

                    // A regular "0" can be used here since CSS allows for unit-less zero values.
                    e.scopes.last.barWidth = new DimenReg(0);

                    e.scopes.last.fracNumerator = e.scopes.last.tokens;
                    e.scopes.last.tokens = [];

                    return [];
                }),
                atopwithdelims: new Primitive('atopwithdelims', function(e) {
                    // Combination of \atop and \abovewithdelims.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var atopDelimsSym = Symbol();
                    e.mouth.saveState(atopDelimsSym);

                    while (true) {
                        var token = e.mouth.eat();

                        if (token && (token.type == 'command' || token.type == 'character' && token.cat == data.cats.active)) {
                            var expansion = e.mouth.expand(token, e.mouth);

                            e.mouth.queue.unshift.apply(e.mouth.queue, expansion);
                        } else if (token && token.type == 'character' && data.delims.includes(token.code) && (token.cat == data.cats.all || token.cat == data.cats.letter)) {
                            if (e.scopes.last.fracLeftDelim) {
                                e.scopes.last.fracRightDelim = token.char;
                                break;
                            } else {
                                e.scopes.last.fracLeftDelim = token.char;
                            }
                        } else {
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(atopDelimsSym);
                            delete e.scopes.last.fracLeftDelim;
                            return [this];
                        }
                    }

                    e.scopes.last.isFrac = true;

                    e.scopes.last.barWidth = new DimenReg(0);

                    e.scopes.last.fracNumerator = e.scopes.last.tokens;
                    e.scopes.last.tokens = [];

                    return [];
                }),
                begingroup: new Primitive('begingroup', function(e) {
                    // \begingroup is almost exactly like {, except that only a \endgroup can close it.
                    // A } won't suffice. It opens a scope similar to how { would, but the scope is
                    // marked as `semisimple' (indicating it was open by \begingroup).

                    // First make sure no superscript or subscript context is open.
                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var beginGSym = Symbol();
                    e.mouth.saveState(beginGSym);

                    new e.Scope();
                    e.scopes.last.semisimple = true;
                    e.openGroups.push(this);
                    e.contexts.push('scope');
                    this.ignore = true;
                    e.scopes.last.tokens.push(this);
                    return [];
                }),
                bf: new Primitive('bf', function(e) {
                    // \bf makes all the characters in the rest of the scope upright and bolded.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    e.tokens.push({
                        type: 'font modifier',
                        value: 'bf'
                    });
                    return [];
                }),
                catcode: new Primitive('catcode', function(e) {
                    // \catcode gets or sets the category code of a character. Catcodes determine how
                    // a character behaves. "{" has catcode 1 and signifies the start of a new group.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var charCode = e.mouth.eat('integer');

                    if (charCode) {
                        if (charCode.value < 0) {
                            e.mouth.revert();
                            this.invalid = true;
                            this.recognized = true;
                            return [this];
                        }
                        if (!(charCode.value in data.cats)) {
                            data.cats[charCode.value] = new IntegerReg(data.cats.all);
                            for (var i = 0, l = e.scopes.length; i < l; i++) {
                                e.scopes[i].cats[charCode.value] = new IntegerReg((i == 0 ? data : e.scopes[i - 1]).cats[charCode.value]);
                            }
                        }
                        return [e.scopes.last.cats[charCode.value]];
                    } else {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }
                }),
                char: new Primitive('char', function(e) {
                    // \char is different in this version of TeX than \char from plain TeX/LaTeX. In
                    // plain TeX, the number passed to \char includes the family number and the number
                    // between [0, 255] that tells the character in the family. In this version, since
                    // there are no families, only the character code of the character is passed as the
                    // number.

                    var charCode = e.mouth.eat('integer');
                    if (!charCode || charCode.value < 0) {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }
                    e.mouth.queue.unshift({
                        type: 'character',
                        cat: data.cats.all,
                        char: String.fromCharCode(charCode.value),
                        code: charCode.value
                    });
                    return [];
                }),
                chardef: new Primitive('chardef', function(e) {
                    // \chardef is used to easily create macros that refer to a single character.
                    // \chardef[command name]=[number] is basically \def[command name]{\char[number]}.
                    // There is one difference though. In regular TeX, \chardef can also act like a
                    // number. In this version though, that's not the case. Most of the code is the
                    // same as \countdef.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var charDefSym = Symbol();
                    e.mouth.saveState(charDefSym);
                    var name = e.mouth.eat();

                    if (name && name.type == 'command') {
                        if (name.name in data.defs.primitive || name.name in data.parameters) {
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(charDefSym);
                            return [true];
                        }
                        var optEquals = e.mouth.eat();
                        if (!optEquals || optEquals.type != 'character' || optEquals.char != '=' || optEquals.cat != data.cats.all) optEquals && e.mouth.revert();
                        var integer = e.mouth.eat('integer');
                        if (!integer || integer.value < 0) {
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(charDefSym);
                            return [true];
                        }
                        var macro = new Macro([{
                            type: 'character',
                            cat: data.cats.all,
                            char: String.fromCharCode(integer.value),
                            code: integer.value
                        }], []);
                        if (e.toggles.global && e.scopes.last.registers.named.globaldefs.value >= 0 || e.scopes.last.registers.named.globaldefs.value > 0) {
                            data.defs.macros[name.name] = macro;
                            delete data.registers.named[name.name];
                            for (var i = 0, l = e.scopes.length; i < l; i++) {
                                e.scopes[i].defs.macros[name.name] = macro;
                                delete e.scopes[i].registers.named[name.name];
                            }
                        } else {
                            e.scopes.last.defs.macros[name.name] = macro;
                            delete e.scopes.last.registers.named[name.name];
                        }
                        e.toggles.global = false;
                    } else {
                        this.invalid = true;
                        this.recognized = true;
                        e.mouth.loadState(charDefSym);
                        return [true];
                    }
                }),
                count: new Primitive('count', function(e) {
                    // Returns the integer register at the specified index.

                    var count = e.mouth.eat('integer');
                    if (!count || count.value < 0) {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }
                    if (!data.registers.count[count.value]) {
                        data.registers.count[count.value] = new IntegerReg(0);
                        for (var i = 0, l = e.scopes.length; i < l; i++) {
                            e.scopes[i].registers.count[count.value] = new IntegerReg((i ? e.scopes[i - 1] : data).registers.count[count.value]);
                        }
                    }
                    return [e.scopes.last.registers.count[count.value]];
                }),
                countdef: new Primitive('countdef', function(e) {
                    // \countdef creates a named register at the specified number.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var countDefSym = Symbol();
                    e.mouth.saveState(countDefSym);
                    var name = e.mouth.eat();

                    // Check that the name is a command. Active characters can also hold register val-
                    // ues, but that would require a whole new object on `data' and all child scopes
                    // to implement, so it's just restricted to command tokens in this version.
                    if (name.type == 'command') {
                        // Make sure it won't overwrite a primitive or parameter.
                        if (name.name in data.defs.primitive || name.name in data.parameters) {
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(countDefSym);
                            return [true];
                        }
                        // Look for an optional equals sign.
                        var optEquals = e.mouth.eat();
                        if (!optEquals || optEquals.type != 'character' || optEquals.char != '=' || optEquals.cat != data.cats.all) optEquals && e.mouth.revert();

                        // Get the integer of the count register to point to.
                        var integer = e.mouth.eat('integer');
                        if (!integer || integer.value < 0) {
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(countDefSym);
                            return [true];
                        }

                        name = name.name;
                        integer = integer.value;

                        // Before making a reference to the register, make sure each level of the scopes
                        // actually has a count register there to be gin with. If a scope doesn't a new one
                        // is made with its initial value set to 0. The new reference will be pointing to
                        // the newly created register.
                        if (!data.registers.count[integer]) {
                            data.registers.count[integer] = new IntegerReg(0);
                            for (var i = 0, l = e.scopes.length; i < l; i++) {
                                e.scopes[i].registers.count[integer] = new IntegerReg((i ? e.scopes[i - 1] : data).registers.count[integer]);
                            }
                        }
                        // Now make the reference. If it's \global a new command is made at all levels. If
                        // not, only the current scope is affected and the command will be deleted once the
                        // scope closes.
                        if (e.toggles.global && e.scopes.last.registers.named.globaldefs.value >= 0 || e.scopes.last.registers.named.globaldefs.value > 0) {
                            data.registers.named[name] = data.registers.count[integer];
                            // Any existing macro with the name of the command has to be deleted so that there
                            // will only be one command with the name that will point to the register.
                            delete data.defs.macros[name];
                            // Do the same thing for each scopes.
                            for (var i = 0, l = e.scopes.length; i < l; i++) {
                                e.scopes[i].registers.named[name] = e.scopes[i].registers.count[integer];
                                delete e.scopes[i].defs.macros[name];
                            }
                        } else {
                            // Only affect the current scope.
                            e.scopes.last.registers.named[name] = e.scopes.last.registers.count[integer];
                            delete e.scopes.last.defs.macros[name];
                        }
                    } else {
                        this.invalid = true;
                        this.recognized = true;
                        e.mouth.loadState(countDefSym);
                        return [true];
                    }
                }),
                cr: new Primitive('cr', function(e) {
                    // \cr is used exclusively in \halign (and macros that build on top of \halign).
                    // This function will return invalid if the current scope is not associated with
                    // a \halign. If it IS associated with a \halign, it will check for \noalign and
                    // \omit commands and create a new scope for the next table cell to store its data
                    // in.

                    if (!e.scopes.last.isHalign && !e.scopes.last.isHalignCell || e.contexts.last != 'scope') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    // \cr means the current row for the \halign is over. The last cell's scope still
                    // needs to be closed.
                    if (e.scopes.last.isHalignCell) {
                        // Before any of the cell closing happens, the preamble for the previous cell needs
                        // to be added in to be parsed. The preamble-adding part is copied from where a-
                        // lignment tokens are parsed.
                        var row = e.scopes[e.scopes.length - 2].cellData[e.scopes[e.scopes.length - 2].cellData.length - 1],
                            halignScope = e.scopes[e.scopes.length - 2];
                        if (!row[row.length - 1].omit && !this.postPreamble) {
                            var column = -1,
                                tokens;
                            for (var i = 0, l = row.length; i < l; i++) {
                                column += row[i].span;
                            }

                            if (halignScope.preamble[column]) {
                                tokens = halignScope.preamble[column][1];
                            } else if (~halignScope.repeatPreambleAt) {
                                var repeatable = halignScope.preamble.slice(halignScope.repeatPreambleAt, halignScope.preamble.length);
                                tokens = repeatable[(column - halignScope.repeatPreambleAt) % repeatable.length][1];
                            } else {
                                this.invalid = true;
                                this.recognized = true;
                                return [this];
                            }
                            this.postPreamble = true;
                            return tokens.concat(this);
                        }

                        e.contexts.pop();
                        var tokens = e.scopes.last.tokens;
                        if (e.scopes.last.isFrac) {
                            row[row.length - 1].content.push({
                                type: 'atom',
                                atomType: 'inner',
                                nucleus: [{
                                    type: 'fraction',
                                    numerator: e.scopes.last.fracNumerator,
                                    denominator: tokens,
                                    barWidth: e.scopes.last.barWidth,
                                    delims: [e.scopes.last.fracLeftDelim, e.scopes.last.fracRightDelim],
                                    nullDelimiterSpace: new DimenReg(e.scopes.last.registers.named.nulldelimiterspace)
                                }],
                                superscript: null,
                                subscript: null
                            });
                            e.scopes.pop();
                        } else {
                            e.scopes.pop();
                            var row = e.scopes.last.cellData[e.scopes.last.cellData.length - 1];
                            row[row.length - 1].content = row[row.length - 1].content.concat(tokens);
                        }
                    }

                    var crNoAlignSym = Symbol();
                    e.mouth.saveState(crNoAlignSym);

                    // The \cr is in the proper context. \noalign is looked for first.
                    while (true) {
                        var token = e.mouth.eat();

                        if (!token) {
                            e.mouth.loadState(crNoAlignSym);
                            e.scopes.last.noAligns.push(null);
                            break;
                        } else if (token.type == 'character' && token.cat != data.cats.active) {
                            e.mouth.loadState(crNoAlignSym);
                            e.scopes.last.noAligns.push(null);
                            break;
                        } else if (token.type == 'command' || token.type == 'character' && token.cat == data.cats.active) {
                            // If it's a register, it's not a \noalign, so break the loop.
                            if (token.name in e.scopes.last.registers.named) {
                                e.mouth.loadState(crNoAlignSym);
                                e.scopes.last.noAligns.push(null);
                                break;
                            }

                            var macro = token.type == 'command' ? e.scopes.last.defs.primitive[token.name] || e.scopes.last.defs.macros[token.name] : e.scopes.last.defs.active[token.char];

                            if (!macro) {
                                e.mouth.loadState(crNoAlignSym);
                                e.scopes.last.noAligns.push(null);
                                break;
                            }
                            // If an expandable primitive is found, expand it to get some tokens.
                            if ((macro === data.defs.primitive.the          || macro.proxy && macro.original === data.defs.primitive.the)          ||
                                (macro === data.defs.primitive.expandafter  || macro.proxy && macro.original === data.defs.primitive.expandafter)  ||
                                (macro === data.defs.primitive.number       || macro.proxy && macro.original === data.defs.primitive.number)       ||
                                (macro === data.defs.primitive.romannumeral || macro.proxy && macro.original === data.defs.primitive.romannumeral) ||
                                (macro === data.defs.primitive.csname       || macro.proxy && macro.original === data.defs.primitive.csname)       ||
                                (macro === data.defs.primitive.string       || macro.proxy && macro.original === data.defs.primitive.string)       ||
                                (macro === data.defs.primitive.if           || macro.isLet && macro.original === data.defs.primitive.if)           ||
                                (macro === data.defs.primitive.ifcase       || macro.isLet && macro.original === data.defs.primitive.ifcase)       ||
                                (macro === data.defs.primitive.ifcat        || macro.isLet && macro.original === data.defs.primitive.ifcat)        ||
                                (macro === data.defs.primitive.ifdim        || macro.isLet && macro.original === data.defs.primitive.ifdim)        ||
                                (macro === data.defs.primitive.ifeof        || macro.isLet && macro.original === data.defs.primitive.ifeof)        ||
                                (macro === data.defs.primitive.iffalse      || macro.isLet && macro.original === data.defs.primitive.iffalse)      ||
                                (macro === data.defs.primitive.ifodd        || macro.isLet && macro.original === data.defs.primitive.ifodd)        ||
                                (macro === data.defs.primitive.ifnum        || macro.isLet && macro.original === data.defs.primitive.ifnum)        ||
                                (macro === data.defs.primitive.ifhmode      || macro.isLet && macro.original === data.defs.primitive.ifhmode)      ||
                                (macro === data.defs.primitive.ifinner      || macro.isLet && macro.original === data.defs.primitive.ifinner)      ||
                                (macro === data.defs.primitive.ifmmode      || macro.isLet && macro.original === data.defs.primitive.ifmmode)      ||
                                (macro === data.defs.primitive.iftrue       || macro.isLet && macro.original === data.defs.primitive.iftrue)       ||
                                (macro === data.defs.primitive.ifvmode      || macro.isLet && macro.original === data.defs.primitive.ifvmode)      ||
                                (macro === data.defs.primitive.ifvoid       || macro.isLet && macro.original === data.defs.primitive.ifvoid)       ||
                                (macro === data.defs.primitive.ifx          || macro.isLet && macro.original === data.defs.primitive.ifx)) {
                                var expansion = e.mouth.expand(token, e.mouth);
                                if (expansion.length == 1 && expansion[0] === token && token.invalid) {
                                    e.mouth.loadState(crNoAlignSym);
                                    e.scopes.last.noAligns.push(null);
                                    break;
                                }
                                e.mouth.queue.unshift.apply(e.mouth.queue, expansion);
                                continue;
                            } else if (macro === data.defs.primitive.noalign || macro.proxy && macro.original === data.defs.primitive.noalign) {
                                var expansion = e.mouth.expand(token, e.mouth);
                                if (expansion.length == 1 && expansion[0] === token && token.invalid) {
                                    e.mouth.loadState(crNoAlignSym);
                                    e.scopes.last.noAligns.push(null);
                                    break;
                                }
                                e.scopes.last.noAligns.push(expansion);
                                break;
                            }

                            if (macro.type == 'primitive' || macro.proxy && macro.original.type == 'primitive') {
                                e.mouth.loadState(crNoAlignSym);
                                e.scopes.last.noAligns.push(null);
                                break;
                            }

                            var expansion = e.mouth.expand(token, e.mouth);
                            if (expansion.length == 1 && expansion[0] ==- token && token.invalid) {
                                e.mouth.loadState(crNoAlignSym);
                                e.scopes.last.noAligns.push(null);
                                break;
                            }
                            e.mouth.queue.unshift.apply(e.mouth.queue, expansion);
                        }
                    }

                    var crcrSym = Symbol();
                    e.mouth.saveState(crcrSym);

                    // If a \crcr is found after a \cr or \noalign, it is skipped over and ignored.
                    // It's more convenient to handle the ignoring part here, and just treat \crcr like
                    // a regular \cr in other situations. /crcr is looked for like above with \noalign.
                    while (true) {
                        var token = e.mouth.eat();

                        if (!token) {
                            e.mouth.loadState(crcrSym);
                            break;
                        } else if (token.type == 'character' && token.cat != data.cats.active) {
                            e.mouth.loadState(crcrSym);
                            break;
                        } else if (token.type == 'command' || token.type == 'character' && token.cat == data.cats.active) {
                            if (token.name in e.scopes.last.registers.named) {
                                e.mouth.loadState(crcrSym);
                                break;
                            }

                            var macro = token.type == 'command' ? e.scopes.last.defs.primitive[token.name] || e.scopes.last.defs.macros[token.name] : e.scopes.last.defs.active[token.char];

                            if (!macro) {
                                e.mouth.loadState(crcrSym);
                                break;
                            }
                            // If an expandable primitive is found, expand it to get some tokens.
                            if ((macro === data.defs.primitive.the          || macro.proxy && macro.original === data.defs.primitive.the)          ||
                                (macro === data.defs.primitive.expandafter  || macro.proxy && macro.original === data.defs.primitive.expandafter)  ||
                                (macro === data.defs.primitive.number       || macro.proxy && macro.original === data.defs.primitive.number)       ||
                                (macro === data.defs.primitive.romannumeral || macro.proxy && macro.original === data.defs.primitive.romannumeral) ||
                                (macro === data.defs.primitive.csname       || macro.proxy && macro.original === data.defs.primitive.csname)       ||
                                (macro === data.defs.primitive.string       || macro.proxy && macro.original === data.defs.primitive.string)       ||
                                (macro === data.defs.primitive.if           || macro.isLet && macro.original === data.defs.primitive.if)           ||
                                (macro === data.defs.primitive.ifcase       || macro.isLet && macro.original === data.defs.primitive.ifcase)       ||
                                (macro === data.defs.primitive.ifcat        || macro.isLet && macro.original === data.defs.primitive.ifcat)        ||
                                (macro === data.defs.primitive.ifdim        || macro.isLet && macro.original === data.defs.primitive.ifdim)        ||
                                (macro === data.defs.primitive.ifeof        || macro.isLet && macro.original === data.defs.primitive.ifeof)        ||
                                (macro === data.defs.primitive.iffalse      || macro.isLet && macro.original === data.defs.primitive.iffalse)      ||
                                (macro === data.defs.primitive.ifodd        || macro.isLet && macro.original === data.defs.primitive.ifodd)        ||
                                (macro === data.defs.primitive.ifnum        || macro.isLet && macro.original === data.defs.primitive.ifnum)        ||
                                (macro === data.defs.primitive.ifhmode      || macro.isLet && macro.original === data.defs.primitive.ifhmode)      ||
                                (macro === data.defs.primitive.ifinner      || macro.isLet && macro.original === data.defs.primitive.ifinner)      ||
                                (macro === data.defs.primitive.ifmmode      || macro.isLet && macro.original === data.defs.primitive.ifmmode)      ||
                                (macro === data.defs.primitive.iftrue       || macro.isLet && macro.original === data.defs.primitive.iftrue)       ||
                                (macro === data.defs.primitive.ifvmode      || macro.isLet && macro.original === data.defs.primitive.ifvmode)      ||
                                (macro === data.defs.primitive.ifvoid       || macro.isLet && macro.original === data.defs.primitive.ifvoid)       ||
                                (macro === data.defs.primitive.ifx          || macro.isLet && macro.original === data.defs.primitive.ifx)) {
                                var expansion = e.mouth.expand(token, e.mouth);
                                if (expansion.length == 1 && expansion[0] === token && token.invalid) {
                                    e.mouth.loadState(crcrSym);
                                    break;
                                }
                                e.mouth.queue.unshift.apply(e.mouth.queue, expansion);
                                continue;
                            } else if (macro === data.defs.primitive.crcr || macro.proxy && macro.original === data.defs.primitive.crcr) {
                                break;
                            }

                            if (macro.type == 'primitive' || macro.proxy && macro.original.type == 'primitive') {
                                e.mouth.loadState(crcrSym);
                                break;
                            }

                            var expansion = e.mouth.expand(token, e.mouth);
                            if (expansion.length == 1 && expansion[0] ==- token && token.invalid) {
                                e.mouth.loadState(crcrSym);
                                break;
                            }
                            e.mouth.queue.unshift.apply(e.mouth.queue, expansion);
                        }
                    }

                    var crCloseSym = Symbol();
                    e.mouth.saveState(crCloseSym);

                    // After a \cr or \noalign, if there's a closing token, it signified the end of the
                    // \halign table. Instead of making a new row, the table scope is closed.
                    while (true) {
                        var token = e.mouth.eat();

                        if (!token) {
                            e.mouth.loadState(crCloseSym);
                            break;
                        } else if (token.type == 'character' && token.cat == data.cats.close) {
                            // A closing character was found, signifying the end of the table. First though,
                            // the tabskip array has to be expanded. If the preamble was set to repeat, then
                            // the tabskip definitions inside them must also repeat. Now that we have the full
                            // table, we can find the longest row according to the amount of cells. With that,
                            // the tabskip array can repeat itself such that it'll be the correct length.
                            var halignScope = e.scopes.last;
                            if (~halignScope.repeatPreambleAt) {
                                var longest = Math.max.apply(Math, halignScope.cellData.map(function(row) {
                                    var span = 0;
                                    for (var i = 0, l = row.length; i < l; i++) {
                                        span += row[i].span;
                                    }
                                    return span;
                                }));
                                var repeat = halignScope.tabSkips.slice(halignScope.repeatPreambleAt + 1, halignScope.tabSkips.length),
                                    index = 0;
                                while (halignScope.tabSkips.length < longest + 1) {
                                    halignScope.tabSkips.push(repeat[index]);
                                    index = (index + 1) % repeat.length;
                                }
                            }
                            e.scopes.pop();
                            e.scopes.last.tokens.push({
                                type: 'atom',
                                atomType: 'inner',
                                nucleus: {
                                    type: 'table',
                                    cellData: halignScope.cellData,
                                    tabSkips: halignScope.tabSkips,
                                    noAligns: halignScope.noAligns
                                },
                                superscript: null,
                                subscript: null
                            });
                            return [];
                        } else if (token.type == 'character' && token.cat != data.cats.active) {
                            e.mouth.loadState(crCloseSym);
                            break;
                        } else if (token.type == 'command' || token.type == 'character' && token.cat == data.cats.active) {
                            if (token.name in e.scopes.last.registers.named) {
                                e.mouth.loadState(crCloseSym);
                                break;
                            }

                            var macro = token.type == 'command' ? e.scopes.last.defs.primitive[token.name] || e.scopes.last.defs.macros[token.name] : e.scopes.last.defs.active[token.char];

                            if (!macro) {
                                e.mouth.loadState(crCloseSym);
                                break;
                            }
                            // If an expandable primitive is found, expand it to get some tokens.
                            if ((macro === data.defs.primitive.the          || macro.proxy && macro.original === data.defs.primitive.the)          ||
                                (macro === data.defs.primitive.expandafter  || macro.proxy && macro.original === data.defs.primitive.expandafter)  ||
                                (macro === data.defs.primitive.number       || macro.proxy && macro.original === data.defs.primitive.number)       ||
                                (macro === data.defs.primitive.romannumeral || macro.proxy && macro.original === data.defs.primitive.romannumeral) ||
                                (macro === data.defs.primitive.csname       || macro.proxy && macro.original === data.defs.primitive.csname)       ||
                                (macro === data.defs.primitive.string       || macro.proxy && macro.original === data.defs.primitive.string)       ||
                                (macro === data.defs.primitive.if           || macro.isLet && macro.original === data.defs.primitive.if)           ||
                                (macro === data.defs.primitive.ifcase       || macro.isLet && macro.original === data.defs.primitive.ifcase)       ||
                                (macro === data.defs.primitive.ifcat        || macro.isLet && macro.original === data.defs.primitive.ifcat)        ||
                                (macro === data.defs.primitive.ifdim        || macro.isLet && macro.original === data.defs.primitive.ifdim)        ||
                                (macro === data.defs.primitive.ifeof        || macro.isLet && macro.original === data.defs.primitive.ifeof)        ||
                                (macro === data.defs.primitive.iffalse      || macro.isLet && macro.original === data.defs.primitive.iffalse)      ||
                                (macro === data.defs.primitive.ifodd        || macro.isLet && macro.original === data.defs.primitive.ifodd)        ||
                                (macro === data.defs.primitive.ifnum        || macro.isLet && macro.original === data.defs.primitive.ifnum)        ||
                                (macro === data.defs.primitive.ifhmode      || macro.isLet && macro.original === data.defs.primitive.ifhmode)      ||
                                (macro === data.defs.primitive.ifinner      || macro.isLet && macro.original === data.defs.primitive.ifinner)      ||
                                (macro === data.defs.primitive.ifmmode      || macro.isLet && macro.original === data.defs.primitive.ifmmode)      ||
                                (macro === data.defs.primitive.iftrue       || macro.isLet && macro.original === data.defs.primitive.iftrue)       ||
                                (macro === data.defs.primitive.ifvmode      || macro.isLet && macro.original === data.defs.primitive.ifvmode)      ||
                                (macro === data.defs.primitive.ifvoid       || macro.isLet && macro.original === data.defs.primitive.ifvoid)       ||
                                (macro === data.defs.primitive.ifx          || macro.isLet && macro.original === data.defs.primitive.ifx)) {
                                var expansion = e.mouth.expand(token, e.mouth);
                                if (expansion.length == 1 && expansion[0] === token && token.invalid) {
                                    e.mouth.loadState(crCloseSym);
                                    break;
                                }
                                e.mouth.queue.unshift.apply(e.mouth.queue, expansion);
                                continue;
                            }

                            if (macro.type == 'primitive' || macro.proxy && macro.original.type == 'primitive') {
                                e.mouth.loadState(crCloseSym);
                                break;
                            }

                            var expansion = e.mouth.expand(token, e.mouth);
                            if (expansion.length == 1 && expansion[0] ==- token && token.invalid) {
                                e.mouth.loadState(crCloseSym);
                                break;
                            }
                            e.mouth.queue.unshift.apply(e.mouth.queue, expansion);
                        }
                    }

                    var crOmitSym = Symbol();
                    e.mouth.saveState(crOmitSym);

                    // Now, add the new row and cell to the scope.
                    e.scopes.last.cellData.push([{
                        type: 'cell',
                        content: [],
                        omit: false,
                        span: 1
                    }]);

                    // Look for \omit the same way as \noalign.
                    while (true) {
                        var token = e.mouth.eat();

                        if (!token) {
                            e.mouth.loadState(crOmitSym);
                            break;
                        } else if (token.type == 'character' && token.cat != data.cats.active) {
                            e.mouth.loadState(crOmitSym);
                            break;
                        } else if (token.type == 'command' || token.type == 'character' && token.cat == data.cats.active) {
                            if (token.name in e.scopes.last.registers.named) {
                                e.mouth.loadState(crOmitSym);
                                break;
                            }

                            var macro = token.type == 'command' ? e.scopes.last.defs.primitive[token.name] || e.scopes.last.defs.macros[token.name] : e.scopes.last.defs.active[token.char];

                            if (!macro) {
                                e.mouth.loadState(crOmitSym);
                                break;
                            }
                            if ((macro === data.defs.primitive.the          || macro.proxy && macro.original === data.defs.primitive.the)          ||
                                (macro === data.defs.primitive.expandafter  || macro.proxy && macro.original === data.defs.primitive.expandafter)  ||
                                (macro === data.defs.primitive.number       || macro.proxy && macro.original === data.defs.primitive.number)       ||
                                (macro === data.defs.primitive.romannumeral || macro.proxy && macro.original === data.defs.primitive.romannumeral) ||
                                (macro === data.defs.primitive.csname       || macro.proxy && macro.original === data.defs.primitive.csname)       ||
                                (macro === data.defs.primitive.string       || macro.proxy && macro.original === data.defs.primitive.string)       ||
                                (macro === data.defs.primitive.if           || macro.isLet && macro.original === data.defs.primitive.if)           ||
                                (macro === data.defs.primitive.ifcase       || macro.isLet && macro.original === data.defs.primitive.ifcase)       ||
                                (macro === data.defs.primitive.ifcat        || macro.isLet && macro.original === data.defs.primitive.ifcat)        ||
                                (macro === data.defs.primitive.ifdim        || macro.isLet && macro.original === data.defs.primitive.ifdim)        ||
                                (macro === data.defs.primitive.ifeof        || macro.isLet && macro.original === data.defs.primitive.ifeof)        ||
                                (macro === data.defs.primitive.iffalse      || macro.isLet && macro.original === data.defs.primitive.iffalse)      ||
                                (macro === data.defs.primitive.ifodd        || macro.isLet && macro.original === data.defs.primitive.ifodd)        ||
                                (macro === data.defs.primitive.ifnum        || macro.isLet && macro.original === data.defs.primitive.ifnum)        ||
                                (macro === data.defs.primitive.ifhmode      || macro.isLet && macro.original === data.defs.primitive.ifhmode)      ||
                                (macro === data.defs.primitive.ifinner      || macro.isLet && macro.original === data.defs.primitive.ifinner)      ||
                                (macro === data.defs.primitive.ifmmode      || macro.isLet && macro.original === data.defs.primitive.ifmmode)      ||
                                (macro === data.defs.primitive.iftrue       || macro.isLet && macro.original === data.defs.primitive.iftrue)       ||
                                (macro === data.defs.primitive.ifvmode      || macro.isLet && macro.original === data.defs.primitive.ifvmode)      ||
                                (macro === data.defs.primitive.ifvoid       || macro.isLet && macro.original === data.defs.primitive.ifvoid)       ||
                                (macro === data.defs.primitive.ifx          || macro.isLet && macro.original === data.defs.primitive.ifx)) {
                                var expansion = e.mouth.expand(token, e.mouth);
                                if (expansion.length == 1 && expansion[0] === token && token.invalid) {
                                    e.mouth.loadState(crOmitSym);
                                    break;
                                }
                                e.mouth.queue.unshift.apply(e.mouth.queue, expansion);
                                continue;
                            } else if (macro === data.defs.primitive.omit || macro.proxy && macro.original === data.defs.primitive.omit) {
                                e.scopes.last.cellData[e.scopes.last.cellData.length - 1][0].omit = true;
                                break;
                            }

                            if (macro.type == 'primitive' || macro.proxy && macro.original.type == 'primitive') {
                                e.mouth.loadState(crOmitSym);
                                break;
                            }

                            var expansion = e.mouth.expand(token, e.mouth);
                            if (expansion.length == 1 && expansion[0] ==- token && token.invalid) {
                                e.mouth.loadState(crOmitSym);
                                break;
                            }
                            e.mouth.queue.unshift.apply(e.mouth.queue, expansion);
                        }
                    }

                    // Open a new scope for the new cell.
                    var halignScope = e.scopes.last;
                    e.contexts.push('scope');
                    new e.Scope();
                    e.scopes.last.isHalignCell = true;

                    // If the cell wasn't marked as `omit', the preamble for the new column needs to be
                    // evaluated.
                    return !halignScope.cellData[halignScope.cellData.length - 1][0].omit ? halignScope.preamble[0][0] : [];
                }),
                crcr: new Primitive('crcr', null), // Set to match \cr's function later
                csname: new Primitive('csname', function(e) {
                    // \csname is used for dynamic command named. Everything after \csname up to the
                    // first instance of \endcsname is recursively expanded until only characters
                    // remain. Then, all the characters are gathered up and compiled into a single
                    // command token with that name.

                    var csnameSym = Symbol();
                    e.mouth.saveState(csnameSym);

                    // This array stores all the tokens that are going to be used in the command name.
                    var name = [];
                    while (true) {
                        // Tokens are continuously eaten until a \endcsname is found.
                        var token = e.mouth.eat('pre space');

                        if (!token) {
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(csnameSym);
                            return [this];
                        } else if (name.length == 0 && token.cat == data.cats.whitespace) {
                            // If a whitespace character is found immediately after the \csname, it has to be
                            // ignored. Normally, this is done automatically by not using the "pre space" con-
                            // text, but it has to be used in this case because whitespace is kept later on.
                            // If there are already tokens in `name', it means the whitespace doesn't immedi-
                            // ately follow the \csname, so it has to be counted.
                            continue;
                        } else if (token.type == 'command' || token.type == 'character' && token.cat == data.cats.active) {
                            // If the command refers to a register, the whole thing is made invalid since reg-
                            // isters can't be turned into characters by themselves.
                            if (token.name in e.scopes.last.registers.named) {
                                this.invalid = true;
                                this.recognized = true;
                                e.mouth.loadState(csnameSym);
                                return [this];
                            }
                            // A macro or active character was found. Look up its definition first.
                            var macro = token.type == 'command' ? e.scopes.last.defs.primitive[token.name] || e.scopes.last.defs.macros[token.name] : e.scopes.last.defs.active[token.char];
                            // If it doesn't have a definition, return invalid.
                            if (!macro) {
                                this.invalid = true;
                                this.recognized = true;
                                e.mouth.loadState(csnameSym);
                                return [this];
                            }
                            // Make sure the token isn't \endcsname.
                            if (macro === data.defs.primitive.endcsname || macro.proxy && macro.original === data.defs.primitive.endcsname) {
                                break;
                            }
                            // If the macro is a primitive, it can't be made into characters by itself and the
                            // thing is made invalid.
                            if (macro instanceof Primitive || macro.proxy && macro.original instanceof Primitive) {
                                this.invalid = true;
                                this.recognized = true;
                                e.mouth.loadState(csnameSym);
                                return [this];
                            }

                            // Now, the macro has to be expanded. The `Mouth.expand' function is used.
                            if (macro.proxy) macro = macro.original;
                            var expansion = e.mouth.expand(token, e.mouth);
                            if (expansion.length == 1 && expansion[0] === token && expansion[0].invalid) {
                                this.invalid = true;
                                this.recognized = true;
                                e.mouth.loadState(csnameSym);
                                return [this];
                            }
                            e.mouth.queue.unshift.apply(e.mouth.queue, expansion);
                        } else name.push(token);
                    }
                    return [{
                        type: 'command',
                        nameType: 'command',
                        escapeChar: String.fromCharCode(e.scopes.last.registers.named.escapechar.value),
                        name: name.map(function(token) {
                            return token.char;
                        }).join('')
                    }];
                }),
                day: new Primitive('day', function(e) {
                    // Returns the current day of the month in the range [1,31].

                    return [new IntegerReg(new Date().getDate())];
                }),
                def: new Primitive('def', function(e) {
                    // \def is able to define new macros. The syntax is \def[command name][parameters]
                    // [replacement text]. [command name] is either a command prefixed with an escape
                    // character, or a regular character with catcode 13 (active character). After that
                    // are [parameters]. This is a list of tokens that don't get expanded. Parameter
                    // tokens act as placeholders for tokens that can be used as arguments for the
                    // [replacement text]. [replacement text] start with an opening character (catcode
                    // 1) and ends in a closing character (catcode 2).

                    // \def isn't allowed after superscript or subscript.
                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    // First, save the state of the mouth in case an error occurs.
                    var defSym = Symbol();
                    e.mouth.saveState(defSym);

                    // The first token should bet the name of the macro.
                    var name = e.mouth.eat();
                    if (!name) {
                        // If there was no token found, the current token is invalid.
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }
                    var type;
                    if (name.type == 'character') {
                        // The macro's name is a single character. Make sure it's catcode 13.
                        if (e.catOf(name.char) == data.cats.active) {
                            // The character is an active character.
                            type = 'active';
                            name = name.char;
                        } else {
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(defSym);
                            return [this];
                        }
                    } else if (name.type == 'command') {
                        // The macro is a command.
                        type = 'macro';
                        name = name.name;
                        // Make sure it's not overriding any primitives or built-in parameters.
                        if (name in e.scopes.last.defs.primitive || name in data.parameters) {
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(defSym);
                            return [this];
                        }
                    }

                    // The name of the macro has been determined at this point. Now look for parameter
                    // tokens.

                    // This array will be the list of parameter tokens to store with the command. Every
                    // call to the command must follow this set of parameter tokens to be considered a
                    // valid call.
                    var params = [];

                    // This number just keeps track of which parameters have already been used since
                    // they need to be ordered consecutively.
                    var used = 0;

                    // In TeX, if you end a command's parameters in a parameter token, like in this
                    // string: "\def\cmd#{test}", then the opening token is added to the parameter
                    // list and the replacement text. `endInOpen' keeps track of that.
                    var endInOpen = false;

                    while (true) {
                        // Tokens are sequentially eaten until the first opening token is found (catcode
                        // 1). At that point, the parameter tokens are done and the replacement text will
                        // start to be absorbed.
                        var token = e.mouth.eat();

                        if (!token) {
                            // If there are no more tokens, then replacement tokens weren't found, which makes
                            // this \def invalid.
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(defSym);
                            return [this];
                        } else if (token.cat == data.cats.open) {
                            // The first opening token was found. The token should be returned and the para-
                            // meter tokens are done parsing.
                            e.mouth.revert();
                            break;
                        } else if (token.cat == data.cats.param) {
                            // A parameter token was found. The next token should either be a number or an o-
                            // pening token.

                            var paramTok = e.mouth.eat('pre space');

                            if (!paramTok) {
                                // No token was found. The command is invalid.
                                this.invalid = true;
                                this.recognized = true;
                                e.mouth.loadState(defSym);
                                return [this];
                            } else if (paramTok.cat == data.cats.open) {
                                // An opening token follows the parameter. Mark `endInOpen' as true, return the
                                // token, and continue.
                                endInOpen = true;
                                e.mouth.revert();
                                params.push({
                                    type: 'character',
                                    cat: data.cats.open,
                                    char: paramTok.char,
                                    code: paramTok.code
                                });
                            } else if (48 < paramTok.code && paramTok.code < 58 && paramTok.cat == data.cats.all && +paramTok.char == used + 1) {
                                // A number was found that references the index of the parameter. Add a regular
                                // parameter token and discard the number token.
                                params.push(token);
                                used++;
                            } else {
                                // Some other token was found after the parameter token. That make the \def command
                                // call invalid.
                                this.invalid = true;
                                this.recognized = true;
                                e.mouth.loadState(defSym);
                                return [this];
                            }
                        } else {
                            // A regular character was found. Add it to `params' and continue.
                            params.push(token);
                        }
                    }

                    // All the parameters have been found. Now, the replacement text needs to be looked
                    // for.

                    // Unbalanced groups are not allowed in the parameter text. This keeps track of how
                    // many group are open that still need to be closed.
                    var openGroups = 0;

                    // This is where all the tokens go. These are the tokens that are used as the re-
                    // placement text.
                    var replacement = [];

                    // For double parameter tokens, the second needs to be skipped.
                    var skip = false;

                    while (true) {
                        var token = e.mouth.eat('pre space');

                        if (!token) {
                            // The replacement text was never closed. Make this command invalid.
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(defSym);
                            return [this];
                        } else if (token.type == 'character' && token.cat == data.cats.param && !skip) {
                            // If a parameter token is found in the definition, it must be followed by a number
                            // corresponding to a parameter index or another parameter token. If it's not fol-
                            // lowed by either of those, the whole thing is marked invalid.
                            var index = e.mouth.eat('pre space');
                            if (index && (index.cat == data.cats.param || (index.cat == data.cats.all && index.char <= params.length && index.char >= 1))) {
                                // Even though it passed the test, the number still needs to be returned so that
                                // it'll be included in the definition.
                                e.mouth.revert();
                                if (index.cat == data.cats.param) skip = true;
                            } else {
                                this.invalid = true;
                                this.recognized = true;
                                e.mouth.loadState(defSym);
                                return [this];
                            }
                        } else if (token.type == 'character' && token.cat == data.cats.open) {
                            // A new group is being opened. It must be closed before the replacement text can
                            // finish parsing.
                            openGroups++;
                        } else if (token.type == 'character' && token.cat == data.cats.close) {
                            // A closing token was found. It is either closing a group that was previously
                            // opened, or its ending the replacement text.
                            openGroups--;
                            if (openGroups == 0) break;
                        } else if (skip) skip = false;
                        replacement.push(token);
                    }
                    // Remove the first opening token.
                    replacement.shift();

                    // If `endInOpen' is true, then an additional opening token should be added to the
                    // replacement text.
                    if (endInOpen) replacement.push(params[params.length - 1]);


                    // This is the object that will be stored. It holds all the data needed to execute
                    // a macro.
                    var macro = new Macro(replacement, params);

                    // All the parsing is done now. All that's left is to store the command.
                    if (e.toggles.global && e.scopes.last.registers.named.globaldefs.value >= 0 || e.scopes.last.registers.named.globaldefs.value > 0) {
                        // There was a \global. The definition should affect all scopes.
                        if (type == 'macro') {
                            // Change the original scope stored at `data'.
                            data.defs.macros[name] = macro;

                            // Delete any named register with the name of the macro.
                            delete data.registers.named[name];

                            // All existing scopes also need to be changed too.
                            for (var i = 0, l = e.scopes.length; i < l; i++) {
                                e.scopes[i].defs.macros[name] = macro;
                                delete e.scopes[i].registers[name];
                            }
                        } else {
                            data.defs.active[name] = macro;
                            delete data.registers.named[name];

                            for (var i = 0, l = e.scopes.length; i < l; i++) {
                                e.scopes[i].defs.ative[name] = macro;
                                delete e.scopes[i].registers[name];
                            }
                        }
                    } else {
                        e.scopes.last.defs[type == 'macro' ? 'macros' : 'active'][name] = macro;
                        delete e.scopes.last.registers.named[name];
                    }

                    e.toggles.global = false;

                    return [];
                }),
                dimen: new Primitive('dimen', function(e) {
                    // Returns the dimension register at the specified index.

                    var dimen = e.mouth.eat('integer');
                    if (!dimen || dimen.value < 0) {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }
                    if (!data.registers.dimen[dimen.value]) {
                        data.registers.dimen[dimen.value] = new DimenReg(0, 0);
                        for (var i = 0, l = e.scopes.length; i < l; i++) {
                            e.scopes[i].registers.dimen[dimen.value] = new DimenReg((i ? e.scopes[i - 1] : data).registers.dimen[dimen.value]);
                        }
                    }
                    return [e.scopes.last.registers.dimen[dimen.value]];
                }),
                dimendef: new Primitive('dimendef', function(e) {
                    // Dimension version of \countdef.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var dimenDefSym = Symbol();
                    e.mouth.saveState(dimenDefSym);
                    var name = e.mouth.eat();

                    if (name.type == 'command') {
                        if (name.name in data.defs.primitive || name.name in data.parameters) {
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(dimenDefSym);
                            return [true];
                        }
                        var optEquals = e.mouth.eat();
                        if (!optEquals || optEquals.type != 'character' || optEquals.char != '=' || optEquals.cat != data.cats.all) optEquals && e.mouth.revert();
                        var integer = e.mouth.eat('integer');
                        if (!integer || integer.value < 0) {
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(dimenDefSym);
                            return [true];
                        }
                        name = name.name;
                        integer = integer.value;
                        if (!data.registers.dimen[integer]) {
                            data.registers.dimen[integer] = new DimenReg(0, 0);
                            for (var i = 0, l = e.scopes.length; i < l; i++) {
                                e.scopes[i].registers.dimen[integer] = new DimenReg((i ? e.scopes[i - 1] : data).registers.dimen[integer]);
                            }
                        }
                        if (e.toggles.global && e.scopes.last.registers.named.globaldefs.value >= 0 || e.scopes.last.registers.named.globaldefs.value > 0) {
                            data.registers.named[name] = data.registers.dimen[integer];
                            delete data.defs.macros[name];
                            for (var i = 0, l = e.scopes.length; i < l; i++) {
                                e.scopes[i].registers.named[name] = e.scopes[i].registers.dimen[integer];
                                delete e.scopes[i].defs.macros[name];
                            }
                        } else {
                            e.scopes.last.registers.named[name] = e.scopes.last.registers.dimen[integer];
                            delete e.scopes.last.defs.macros[name];
                        }
                    } else {
                        this.invalid = true;
                        this.recognized = true;
                        e.mouth.loadState(countDefSym);
                        return [true];
                    }
                }),
                displaylimits: new Primitive('displaylimits', function(e) {
                    // \displaylimits controls where superscripts and subscripts are displayed. If the
                    // current style is in display mode (even if it was changed via a \displaystyle
                    // command), then the superscripts and subscripts are rendered above and below the
                    // previous Op(erator) atom, respectively. A temporary token is added that will be
                    // resolved later (once the \displaystyle commands have been taken into account).

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    e.tokens.push({
                        type: 'limit modifier',
                        value: 'display',
                        token: this
                    });
                    return [];
                }),
                displaystyle: new Primitive('displaystyle', function(e) {
                    // \displaystyle makes all the characters in the rest of the scope appear as a dis-
                    // played equation.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    e.tokens.push({
                        type: 'font modifier',
                        value: 'displaystyle'
                    });
                    return [];
                }),
                divide: new Primitive('divide', function(e) {
                    // \divide divides a register by a specified value.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var divideSym = Symbol();
                    e.mouth.saveState(divideSym);

                    while (true) {
                        var register = e.mouth.eat();

                        if (register && (register.type == 'command' || register.type == 'character' && register.cat == data.cats.active)) {
                            var expansion = e.mouth.expand(register, e.mouth);

                            e.mouth.queue.unshift.apply(e.mouth.queue, expansion);
                        } else if (register && register.register) {
                            if (register && register.register) {
                                var token = e.mouth.eat();

                                if (token && token.type == 'character' && (token.char == 'b' || token.char == 'B') && token.cat != data.cats.active) {
                                    var y = e.mouth.eat();
                                    if (!(y && y.type == 'character' && (y.char == 'y' || y.char == 'Y') && y.cat != data.cats.active)) e.mouth.revert(2);
                                } else if (token) e.mouth.revert();
                                else {
                                    this.invalid = true;
                                    this.recognized = true;
                                    e.mouth.loadState(divideSym);
                                    return [this];
                                }

                                var divisor = e.mouth.eat('integer');

                                if (divisor) {
                                    if (register.type == 'integer') {
                                        register.value = ~~(register.value / divisor.value);
                                        var reg = register;
                                        if (e.toggles.global && e.scopes.last.registers.named.globaldefs.value >= 0 || e.scopes.last.registers.named.globaldefs.value > 0) {
                                            while (register.parent) {
                                                register = register.parent;
                                                register.value = reg.value;
                                            }
                                        }
                                        e.toggles.global = false;
                                    } else if (register.type == 'dimension') {
                                        register.sp.value = ~~(register.sp.value / divisor.value);
                                        register.em.value = ~~(register.em.value / divisor.value);
                                        var reg = register;
                                        if (e.toggles.global && e.scopes.last.registers.named.globaldefs.value >= 0 || e.scopes.last.registers.named.globaldefs.value > 0) {
                                            while (register.parent) {
                                                register = register.parent;
                                                register.sp.value = reg.sp.value;
                                                register.em.value = reg.em.value;
                                            }
                                        }
                                        e.toggles.global = false;
                                    } else if (register.type == 'mu dimension') {
                                        register.mu.value = ~~(register.mu.value / divisor.value);
                                        var reg = register;
                                        if (e.toggles.global && e.scopes.last.registers.named.globaldefs.value >= 0 || e.scopes.last.registers.named.globaldefs.value > 0) {
                                            while (register.parent) {
                                                register = register.parent;
                                                register.mu.value = reg.mu.value;
                                            }
                                        }
                                        e.toggles.global = false;
                                    } else if (register.type == 'glue') {
                                        register.start.sp.value = ~~(register.start.sp.value / divisor.value);
                                        register.start.em.value = ~~(register.start.em.value / divisor.value);
                                        if (register.stretch.type == 'infinite dimension') register.stretch.number.value = ~~(register.stretch.number.value / divisor.value);
                                        else {
                                            register.stretch.sp.value = ~~(register.stretch.sp.value / divisor.value);
                                            register.stretch.em.value = ~~(register.stretch.em.value / divisor.value);
                                        }
                                        if (register.shrink.type == 'infinite dimension') register.shrink.number.value = ~~(register.shrink.number.value / divisor.value);
                                        else {
                                            register.shrink.sp.value = ~~(register.shrink.sp.value / divisor.value);
                                            register.shrink.em.value = ~~(register.shrink.em.value / divisor.value);
                                        }
                                        var reg = register;
                                        if (e.toggles.global && e.scopes.last.registers.named.globaldefs.value >= 0 || e.scopes.last.registers.named.globaldefs.value > 0) {
                                            while (register.parent) {
                                                register = register.parent;
                                                register.start.sp.value = reg.start.sp.value;
                                                register.start.em.value = reg.start.em.value;
                                                if (reg.stretch.type == 'infinite dimension') register.stretch = new InfDimen(reg.stretch.number.value, reg.stretch.magnitude.value);
                                                else register.stretch = new DimenReg(reg.stretch.sp.value, reg.stretch.em.value);
                                                if (reg.shrink.type == 'infinite dimension') register.shrink = new InfDimen(reg.shrink.number.value, reg.shrink.magnitude.value);
                                                else register.shrink = new DimenReg(reg.shrink.sp.value, reg.shrink.em.value);
                                            }
                                        }
                                        e.toggles.global = false;
                                    } else if (register.type == 'mu glue') {
                                        register.start.mu.value = ~~(register.start.mu.value / divisor.value);
                                        if (register.stretch.type == 'infinite dimension') register.stretch.number.value = ~~(register.stretch.number.value / divisor.value);
                                        else register.stretch.mu.value = ~~(register.stretch.mu.value / divisor.value);
                                        if (register.shrink.type == 'infinite dimension') register.shrink.number.value = ~~(register.shrink.number.value / divisor.value);
                                        else register.shrink.mu.value = ~~(register.shrink.mu.value / divisor.value);
                                        var reg = register;
                                        if (e.toggles.global && e.scopes.last.registers.named.globaldefs.value >= 0 || e.scopes.last.registers.named.globaldefs.value > 0) {
                                            while (register.parent) {
                                                register = register.parent;
                                                register.start.mu.value = reg.start.mu.value;
                                                if (reg.stretch.type == 'infinite dimension') register.stretch = new InfDimen(reg.stretch.number.value, reg.stretch.magnitude.value);
                                                else register.stretch = new MuDimenReg(reg.stretch.mu.value);
                                                if (reg.shrink.type == 'infinite dimension') register.shrink = new InfDimen(reg.shrink.number.value, reg.shrink.magnitude.value);
                                                else register.shrink = new MuDimenReg(reg.shrink.mu.value);
                                            }
                                        }
                                        e.toggles.global = false;
                                    }
                                } else {
                                    this.invalid = true;
                                    this.recognized = true;
                                    e.mouth.loadState(divideSym);
                                    return [this];
                                }
                                break;
                            } else {
                                this.invalid = true;
                                this.recognized = true;
                                e.mouth.loadState(divideSym);
                                return [this]
                            }
                        } else {
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(divideSym);
                            return [this];
                        }
                    }
                    return [];
                }),
                edef: new Primitive('edef', function(e) {
                    // \edef works kind of like \def. The parameters are found and absorbed like nor-
                    // mal, but the tokens in the replacement text are expanded until only non-expand-
                    // able characters remain. If a macro is encountered that requires a parameter, and
                    // the parameter is a literal parameter token (#) (i.e. it should be replaced by
                    // the \edef's parameters), then an error is raised. \edef has a weird behavior.
                    // For example: \edef\cmd{\catcode`\f=\active}. You might expect everything in the
                    // curly braces to be evaluated (like \edef claims to do), but primitives aren't
                    // expanded. That means the \catcode command is skipped over. After that, a grave
                    // character is found. Normally "`\f" would be interpreted as an integer (since it
                    // is after \catcode), but it's not in this case because \catcode isn't evaluated.
                    // Instead, the "\f" is interpreted as a command. If "\f" isn't defined, then an
                    // error is raised, and the whole thing is made invalid. Even though it would work
                    // outside of \edef, the tokens don't parse correctly. This is true even for real
                    // TeX, so it's actually intended to act that way. If there's ever a case like that
                    // above, it's better to just use regular \def.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var defSym = Symbol();
                    e.mouth.saveState(defSym);
                    var name = e.mouth.eat();
                    if (!name) {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }
                    var type;
                    if (name.type == 'character') {
                        if (e.catOf(name.char) == data.cats.active) {
                            type = 'active';
                            name = name.char;
                        } else {
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(defSym);
                            return [this];
                        }
                    } else if (name.type == 'command') {
                        type = 'macro';
                        name = name.name;
                        if (name in e.scopes.last.defs.primitive || name in data.parameters) {
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(defSym);
                            return [this];
                        }
                    }
                    var params = [],
                        used = 0,
                        endInOpen = false;
                    while (true) {
                        var token = e.mouth.eat();
                        if (!token) {
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(defSym);
                            return [this];
                        } else if (token.cat == data.cats.open) {
                            e.mouth.revert();
                            break;
                        } else if (token.cat == data.cats.param) {
                            var paramTok = e.mouth.eat('pre space');
                            if (!paramTok) {
                                this.invalid = true;
                                this.recognized = true;
                                e.mouth.loadState(defSym);
                                return [this];
                            } else if (paramTok.cat == data.cats.open) {
                                endInOpen = true;
                                e.mouth.revert();
                                params.push({
                                    type: 'character',
                                    cat: data.cats.open,
                                    char: paramTok.char,
                                    code: paramTok.code
                                })
                            } else if (48 < paramTok.code && paramTok.code < 58 && paramTok.cat == data.cats.all && +paramTok.char == used + 1) {
                                params.push(token);
                                used++;
                            } else {
                                this.invalid = true;
                                this.recognized = true;
                                e.mouth.loadState(defSym);
                                return [this];
                            }
                        } else params.push(token);
                    }
                    // If `noexpand' is true, the next token to be eaten is NOT expanded and is added
                    // to `replacement' right away.
                    var openGroups = 0,
                        replacement = [],
                        noexpand = false,
                        skip = false;
                    while (true) {
                        // This is where the tokens are absorbed for the replacement text. If a macro or
                        // active character is found, it is automatically expanded.
                        var token = e.mouth.eat();

                        if (!token) {
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(defSym);
                            return [this];
                        } else if (token.type == 'character' && token.cat == data.cats.param && !skip) {
                            var index = e.mouth.eat('pre space');
                            if (index && (index.cat == data.cats.param || (index.cat == data.cats.all && index.char <= params.length && index.char >= 1))) {
                                e.mouth.revert();
                                if (index.cat == data.cats.param) skip = true;
                            } else {
                                this.invalid = true;
                                this.recognized = true;
                                e.mouth.loadState(defSym);
                                return [this];
                            }
                            replacement.push(token);
                            noexpand = false;
                        } else if (token.type == 'character' && token.cat == data.cats.open) {
                            openGroups++;
                            replacement.push(token);
                            noexpand = false;
                        } else if (token.type == 'character' && token.cat == data.cats.close) {
                            openGroups--;
                            if (openGroups == 0) break;
                            replacement.push(token);
                            noexpand = false;
                        } else if (noexpand) {
                            replacement.push(token);
                            noexpand = false;
                        } else if (token.type == 'command' || token.type == 'character' && token.cat == data.cats.active) {
                            // If the command refers to a register, it should be added to the replacement and
                            // continue.
                            if (token.name in e.scopes.last.registers.named) {
                                replacement.push(token);
                                continue;
                            }
                            // A macro or active character was found. Look up its definition first.
                            var macro = token.type == 'command' ? e.scopes.last.defs.primitive[token.name] || e.scopes.last.defs.macros[token.name] : e.scopes.last.defs.active[token.char];
                            // If it doesn't have a definition, return invalid.
                            if (!macro) {
                                this.invalid = true;
                                this.recognized = true;
                                e.mouth.loadState(defSym);
                                return [this];
                            }
                            // Some primitives are actually expandable, like \the. If one of those special
                            // primitives are found, they are called and expanded like normal.
                            if ((macro === data.defs.primitive.the          || macro.proxy && macro.original === data.defs.primitive.the)          ||
                                (macro === data.defs.primitive.expandafter  || macro.proxy && macro.original === data.defs.primitive.expandafter)  ||
                                (macro === data.defs.primitive.number       || macro.proxy && macro.original === data.defs.primitive.number)       ||
                                (macro === data.defs.primitive.romannumeral || macro.proxy && macro.original === data.defs.primitive.romannumeral) ||
                                (macro === data.defs.primitive.csname       || macro.proxy && macro.original === data.defs.primitive.csname)       ||
                                (macro === data.defs.primitive.string       || macro.proxy && macro.original === data.defs.primitive.string)       ||
                                (macro === data.defs.primitive.if           || macro.isLet && macro.original === data.defs.primitive.if)           ||
                                (macro === data.defs.primitive.ifcase       || macro.isLet && macro.original === data.defs.primitive.ifcase)       ||
                                (macro === data.defs.primitive.ifcat        || macro.isLet && macro.original === data.defs.primitive.ifcat)        ||
                                (macro === data.defs.primitive.ifdim        || macro.isLet && macro.original === data.defs.primitive.ifdim)        ||
                                (macro === data.defs.primitive.ifeof        || macro.isLet && macro.original === data.defs.primitive.ifeof)        ||
                                (macro === data.defs.primitive.iffalse      || macro.isLet && macro.original === data.defs.primitive.iffalse)      ||
                                (macro === data.defs.primitive.ifodd        || macro.isLet && macro.original === data.defs.primitive.ifodd)        ||
                                (macro === data.defs.primitive.ifnum        || macro.isLet && macro.original === data.defs.primitive.ifnum)        ||
                                (macro === data.defs.primitive.ifhmode      || macro.isLet && macro.original === data.defs.primitive.ifhmode)      ||
                                (macro === data.defs.primitive.ifinner      || macro.isLet && macro.original === data.defs.primitive.ifinner)      ||
                                (macro === data.defs.primitive.ifmmode      || macro.isLet && macro.original === data.defs.primitive.ifmmode)      ||
                                (macro === data.defs.primitive.iftrue       || macro.isLet && macro.original === data.defs.primitive.iftrue)       ||
                                (macro === data.defs.primitive.ifvmode      || macro.isLet && macro.original === data.defs.primitive.ifvmode)      ||
                                (macro === data.defs.primitive.ifvoid       || macro.isLet && macro.original === data.defs.primitive.ifvoid)       ||
                                (macro === data.defs.primitive.ifx          || macro.isLet && macro.original === data.defs.primitive.ifx)) {
                                var expansion = e.mouth.expand(token, e.mouth);
                                if (expansion.length == 1 && expansion[0] === token && token.invalid) {
                                    this.invalid = true;
                                    this.recognized = true;
                                    e.mouth.loadState(defSym);
                                    return [this];
                                }
                                e.mouth.queue.unshift.apply(e.mouth.queue, expansion);
                                continue;
                            } else if (macro === data.defs.primitive.noexpand || macro.proxy && macro.original === data.defs.primitive.noexpand) {
                                noexpand = true;
                                continue;
                            }
                            // If the macro is any other primitive, don't expand it.
                            if (macro instanceof Primitive || macro.proxy && macro.original instanceof Primitive) {
                                replacement.push(token);
                                continue;
                            }

                            // Now, the macro has to be expanded.
                            e.mouth.queue.unshift.apply(e.mouth, e.mouth.expand(token, e.mouth));
                        } else replacement.push(token);
                    }

                    replacement.shift();
                    if (endInOpen) replacement.push(params[params.length - 1]);
                    var macro = new Macro(replacement, params);
                    if (e.toggles.global && e.scopes.last.registers.named.globaldefs.value >= 0 || e.scopes.last.registers.named.globaldefs.value > 0) {
                        if (type == 'macro') {
                            data.defs.macros[name] = macro;
                            delete data.registers.named[name];
                            for (var i = 0, l = e.scopes.length; i < l; i++) {
                                e.scopes[i].defs.macros[name] = macro;
                                delete e.scopes[i].registers.named[name];
                            }
                        } else {
                            data.defs.active[name] = macro;
                            delete data.registers.named[name];
                            for (var i = 0, l = e.scopes.length; i < l; i++) {
                                e.scopes[i].defs.ative[name] = macro;
                                delete e.scopes[i].registers.named[name];
                            }
                        }
                    } else {
                        e.scopes.last.defs[type == 'macro' ? 'macros' : 'active'][name] = macro;
                        delete e.scopes.last.registers.named[name];
                    }
                    e.toggles.global = false;
                    return [];
                }),
                else: new Primitive('else', function(e) {
                    // \else is only allowed in the context of a \if. \if commands (more specifically
                    // the `evalIf' function) all evaluate \else commands in their own definitions, so
                    // if this function is being called, it means it's in the wrong context and should
                    // return invalid.

                    this.invalid = true;
                    this.recognized = true;
                    return [this];
                }),
                endcsname: new Primitive('endcsname', function(e) {
                    // \endcsname is used as the closer for \csname. Since \csname parses up to the
                    // first \endcsname though, this primitive function isn't actually called at the
                    // end of a \csname. If this function DOES get called, it means that there isn't
                    // a \csname before it, and that its call is invalid. This function automatically
                    // returns invalid instead of actually doing anything. It's only here to be used in
                    // csname.
                    this.invalid = true;
                    this.recognized = true;
                    return [this];
                }),
                endgroup: new Primitive('endgroup', function(e) {
                    // \endgroup closes groups opened by \begingroup.
                    if (!e.openGroups.length || e.scopes.last.delimited || e.scopes.last.isHalign || e.scopes.last.isHalignCell || !e.scopes.last.semisimple || e.contexts.last != 'scope') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    e.openGroups.pop();
                    e.contexts.pop();
                    var tokens = e.scopes.last.tokens;
                    if (e.scopes.last.isFrac) {
                        e.scopes[e.scopes.length - 2].tokens.push({
                            type: 'atom',
                            atomType: 0,
                            nucleus: [{
                                type: 'atom',
                                atomType: 'inner',
                                nucleus: [{
                                    type: 'fraction',
                                    numerator: e.scopes.last.fracNumerator,
                                    denominator: tokens,
                                    barWidth: e.scopes.last.barWidth,
                                    delims: [e.scopes.last.fracLeftDelim, e.scopes.last.fracRightDelim],
                                    nullDelimiterSpace: new DimenReg(e.scopes.last.registers.named.nulldelimiterspace)
                                }],
                                superscript: null,
                                subscript: null
                            }],
                            superscript: null,
                            subscript: null
                        });
                        e.scopes.pop();
                    } else {
                        e.scopes.pop();
                        e.scopes.last.tokens.push({
                            type: 'atom',
                            atomType: 0,
                            nucleus: tokens,
                            superscript: null,
                            subscript: null
                        });
                    }
                }),
                Error: new Primitive('Error', function(e) {
                    // \Error is not a builtin TeX primitive. In TeX, there's a way to write to the
                    // terminal to report errors. In this version of TeX, error are reported by marking
                    // tokens as invalid and rendering them in red. That's where this primitive comes
                    // in. It takes a single argument and will expand to the argument while marking it
                    // invalid.

                    var errSym = Symbol();
                    e.mouth.saveState(errSym);

                    var token = e.mouth.eat();
                    if (!token || token.type != 'character' || token.cat != data.cats.open) {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    } else {
                        var openGroups = 0,
                            tokens = [];
                        while (true) {
                            var token = e.mouth.eat('pre space');

                            if (!token) {
                                this.invalid = true;
                                this.recognized = true;
                                e.mouth.loadState(errSym);
                                return [this];
                            } else if (token.type == 'character' && token.cat == data.cats.open) {
                                openGroups++;
                                tokens.push(token.char);
                            } else if (token.type == 'character' && token.cat == data.cats.close) {
                                if (!openGroups) break;
                                openGroups--;
                                tokens.push(token.char);
                            } else if (token.type == 'command') {
                                tokens.push(token.escapeChar);
                                tokens.push.apply(tokens, token.name.split(''));
                            } else {
                                tokens.push(token.char);
                            }
                        }
                        return tokens.map(function(a) {
                            return {
                                type: 'character',
                                char: a,
                                code: a.charCodeAt(0),
                                cat: 12,
                                invalid: true
                            };
                        });
                    }
                }),
                expandafter: new Primitive('expandafter', function(e) {
                    // \expandafter takes two arguments. The first is a token that's absorbed and left
                    // alone unexpanded. The second is another token. The second token is expanded
                    // first, only one layer. Then the first token along with the expanded tokens are
                    // placed back in the queue to be parsed naturally. Basically, \expandafter will
                    // expand the tokens AFTER a macro before expanding the macro itself. Unlike
                    // \noexpand, whose only real use is inside \edef and \xdef, \noexpand can be used
                    // outside of definitions and work as intended, as well as in \edef and \xdef.

                    var expandAfterSym = Symbol();
                    e.mouth.saveState(expandAfterSym);

                    // This is the token that is skipped before expanding the second token.
                    var first = e.mouth.eat();
                    if (!first) {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    // Now the second token is eaten and expanded. Even if it's not expandable, an ar-
                    // ray is still returned with the same token unexpanded.
                    var second = e.mouth.eat(),
                        expansion = e.mouth.expand(second, e.mouth);
                    if (expansion.length == 1 && expansion[0] === second && second.invalid) {
                        this.invalid = true;
                        this.recognized = true;
                        e.mouth.loadState(expandAfterSym);
                        return [this];
                    }

                    // Now, add the tokens back to the mouth with the second token expanded and the
                    // first left alone.
                    return [first].concat(expansion);
                }),
                fi: new Primitive('fi', function(e) {
                    // \fi works the same as \else in that it's handled in the definitions of \if com-
                    // mands. It should always return invalid. \fi is used to close \if blocks.

                    this.invalid = true;
                    this.recognized = true;
                    return [this];
                }),
                futurelet: new Primitive('futurelet', function(e) {
                    // \futurelet is used to look at the next upcoming token and do something with it,
                    // before it is absorbed. \futurelet[command name][token 1][token 2] is basically
                    // the same as \let[command name][token 2][token 1][token 2]. First, the \let is
                    // executed and [command name] == [token 2]. Then, [token 1] has access to [token
                    // 2] via [command name]. It's able to expand into a macro that uses (and expects)
                    // [token 2] as a parameter.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var letSym = Symbol();
                    e.mouth.saveState(letSym);

                    var name = e.mouth.eat();
                    if (!name) {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }
                    var type;
                    if (name.type == 'character') {
                        if (e.catOf(name.char) == data.cats.active) {
                            type = 'active';
                            name = name.char;
                        } else {
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(letSym);
                            return [this];
                        }
                    } else if (name.type == 'command') {
                        type = 'macro';
                        name = name.name;
                        if (name in e.scopes.last.defs.primitive || name in data.parameters) {
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(letSym);
                            return [this];
                        }
                    }

                    var optEquals = e.mouth.eat();
                    if (!optEquals || optEquals.type != 'character' || optEquals.char != '=' || optEquals.cat != data.cats.all) optEquals && e.mouth.revert();

                    // `token1' is the token that is skipped. Once that's been absorbed, the next token
                    // is what's used for the \let operation.
                    var token1 = e.mouth.eat();

                    if (!token1) {
                        this.invalid = true;
                        this.recognized = true;
                        e.mouth.loadState(letSym);
                        return [this];
                    }

                    var token2 = e.mouth.eat();

                    if (!token2) {
                        this.invalid = true;
                        this.recognized = true;
                        e.mouth.loadState(letSym);
                        return [this];
                    } else if (token2.type == 'command' || token2.type == 'character' && token2.cat == data.cats.active) {
                        var macro = token2.type == 'command' ? e.scopes.last.defs.primitive[token2.name] || e.scopes.last.defs.macros[token2.name] : e.scopes.last.defs.active[token2.name];
                        if (macro) macro = new Macro(macro, macro.type == 'primitive' || macro.isLet);
                        else if (token2.type == 'command' && type == 'macro') {
                            // Check if the command refers to a register.
                            var reg = e.scopes.last.registers.named[token2.name];
                            if (reg) {
                                // If it does, make a new entry in the named registers.
                                if (e.toggles.global && e.scopes.last.registers.named.globaldefs.value >= 0 || e.scopes.last.registers.named.globaldefs.value > 0) {
                                    data.registers.named[name] = reg;
                                    delete data.defs.macros[name];
                                    for (var i = 0, l = e.scopes.length; i < l; i++) {
                                        e.scopes[i].registers.named[name] = reg;
                                        delete e.scopes[i].defs.macros[name];
                                    }
                                } else {
                                    e.scopes.last.registers.named[name] = reg;
                                    delete e.scopes.last.defs.macros[name];
                                }
                                e.toggles.global = false;
                                return [];
                            }
                        }
                    } else {
                        // There are two calls to new Macro so that the macro is recognized as a proxy.
                        var macro = new Macro(new Macro([token2]), true);
                    }

                    if (e.toggles.global && e.scopes.last.registers.named.globaldefs.value >= 0 || e.scopes.last.registers.named.globaldefs.value > 0) {
                        if (type == 'macro') {
                            if (macro) data.defs.macros[name] = macro;
                            else delete data.defs.macros[name];
                            delete data.registers.named[name];
                            for (var i = 0, l = e.scopes.length; i < l; i++) {
                                if (macro) e.scopes[i].defs.macros[name] = macro;
                                else delete e.scopes[i].defs.macros[name];
                                delete e.scopes[i].registers.named[name];
                            }
                        } else {
                            if (macro) data.defs.active[name] = macro;
                            else delete e.scopes[i].defs.macros[name];
                            delete data.registers.named[name];
                            for (var i = 0, l = e.scopes.length; i < l; i++) {
                                if (macro) e.scopes[i].defs.ative[name] = macro;
                                else delete e.scopes[i].defs.macros[name];
                                delete e.scopes[i].registers.named[name];
                            }
                        }
                    } else {
                        if (macro) e.scopes.last.defs[type == 'macro' ? 'macros' : 'active'][name] = macro;
                        else delete e.scopes.last.defs[type == 'macro' ? 'macros' : 'active'][name];
                        delete e.scopes.last.registers.named[name];
                    }

                    e.toggles.global = false;

                    return [token1, token2];
                }),
                gdef: new Primitive('gdef', function(e) {
                    // \gdef is exactly the same as \global\def. It doesn't matter if there is a
                    // \global before the command as \global\global\def is the same as \global\def
                    // (i.e. it doesn't matter how many \global commands there are). If \globaldefs is
                    // negative though, it is still able to negate the \global in \gdef. Most of the
                    // code is exactly the same as \def, so comments aren't repeated.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var defSym = Symbol();
                    e.mouth.saveState(defSym);
                    var name = e.mouth.eat();
                    if (!name) {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }
                    var type;
                    if (name.type == 'character') {
                        if (e.catOf(name.char) == data.cats.active) {
                            type = 'active';
                            name = name.char;
                        } else {
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(defSym);
                            return [this];
                        }
                    } else if (name.type == 'command') {
                        type = 'macro';
                        name = name.name;
                        if (name in e.scopes.last.defs.primitive || name in data.parameters) {
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(defSym);
                            return [this];
                        }
                    }
                    var params = [],
                        used = 0,
                        endInOpen = false;
                    while (true) {
                        var token = e.mouth.eat();
                        if (!token) {
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(defSym);
                            return [this];
                        } else if (token.cat == data.cats.open) {
                            e.mouth.revert();
                            break;
                        } else if (token.cat == data.cats.param) {
                            var paramTok = e.mouth.eat('pre space');
                            if (!paramTok) {
                                this.invalid = true;
                                this.recognized = true;
                                e.mouth.loadState(defSym);
                                return [this];
                            } else if (paramTok.cat == data.cats.open) {
                                endInOpen = true;
                                e.mouth.revert();
                                params.push({
                                    type: 'character',
                                    cat: data.cats.open,
                                    char: paramTok.char,
                                    code: paramTok.code
                                });
                            } else if (48 < paramTok.code && paramTok.code < 58 && paramTok.cat == data.cats.all && +paramTok.char == used + 1) {
                                params.push(token);
                                used++;
                            } else {
                                this.invalid = true;
                                this.recognized = true;
                                e.mouth.loadState(defSym);
                                return [this];
                            }
                        } else {
                            params.push(token);
                        }
                    }
                    var openGroups = 0,
                        replacement = [],
                        skip = false;
                    while (true) {
                        var token = e.mouth.eat();
                        if (!token) {
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(defSym);
                            return [this];
                        } else if (token.type == 'character' && token.cat == data.cats.param && !skip) {
                            var index = e.mouth.eat('pre space');
                            if (index && (index.cat == data.cats.param || (index.cat == data.cats.all && index.char <= params.length && index.char >= 1))) {
                                e.mouth.revert();
                                if (index.cat == data.cats.param) skip = true;
                            } else {
                                this.invalid = true;
                                this.recognized = true;
                                e.mouth.loadState(defSym);
                                return [this];
                            }
                        } else if (token.type == 'character' && token.cat == data.cats.open) openGroups++;
                        else if (token.type == 'character' && token.cat == data.cats.close) {
                            openGroups--;
                            if (openGroups == 0) break;
                        }
                        replacement.push(token);
                    }
                    replacement.shift();
                    if (endInOpen) replacement.push(params[params.length - 1]);
                    var macro = new Macro(replacement, params);
                    if (e.scopes.last.registers.named.globaldefs.value < 0) {
                        e.scopes.last.defs[type == 'macro' ? 'macros' : 'active'][name] = macro;
                        delete e.scopes.last.registers.named[name];
                    } else {
                        if (type == 'macro') {
                            data.defs.macros[name] = macro;
                            delete data.registers.named[name];
                            for (var i = 0, l = e.scopes.length; i < l; i++) {
                                e.scopes[i].defs.macros[name] = macro;
                                delete e.scopes[i].registers.named[name];
                            }
                        } else {
                            data.defs.active[name] = macro;
                            delete data.registers.named[name];
                            for (var i = 0, l = e.scopes.length; i < l; i++) {
                                e.scopes[i].defs.ative[name] = macro;
                                delete e.scopes[i].registers.named[name];
                            }
                        }
                    }
                    e.toggles.global = false;
                    return [];
                }),
                global: new Primitive('global', function(e) {
                    // \global makes the next definition affect all scopes, including any future scopes
                    // that haven't been created yet. If the next token isn't a definition, then it is
                    // marked as invalid (that doesn't happen here though since the parser doesn't know
                    // what the next token is yet).

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    e.toggles.global = this;
                    this.ignore = true;
                    return [this];
                }),
                halign: new Primitive('halign', function(e) {
                    // \halign is used to create tables. It's used in the creation of matrices, but can
                    // be used directly by the user to create custom tables formatted according to a
                    // template. The argument must be enclosed in opening and closing tokens. Each line
                    // of the table is defined by a \cr ending. Each line is split into columns, which
                    // are defined by an alignment token ending (usually &). A 2x2 table for example
                    // would be formatted as (0, 0) & (0, 1) \cr (1, 0) & (1, 1). \halign uses the
                    // first row provided in its argument as a template for the rest of the rows (which
                    // is also called the table's preamble). The template is used to define what will
                    // go around each cell in the table. If one of the columns in the preamble is \sl#,
                    // then each cell in that column will be preceded by \sl, which will make each cell
                    // render in an oblique (slanted) font. If another was \hfil\hfil#\hfil, then the
                    // content of the cell would be positioned such that there would be 2x amount of
                    // space on the left and 1x amount of space on the right. A table cell can also use
                    // the \omit primitive to omit the template altogether. That'll cause only the ta-
                    // ble cell's content to be displayed without whatever was defined in the template.
                    // After each \cr, a \noalign command is allowed, which will add a "nonaligned" row
                    // to the table (which is just a row with a single long cell). The text inside the
                    // \noalign command's argument will be added to the row. This lets you add vertical
                    // spacing between rows in case you want them to be further apart. In TeX, you can
                    // also add negative space to make rows overlap each other, but that's not allowed
                    // with HTML <table>s, so that's not implemented in this version. Also, each table
                    // cell is treated as its own group. Saying \sl in one cell won't cause all the
                    // cells following it to also be slanted since \sl is contained to its own group.
                    // Also also, in TeX, you can't really use this command in math mode, but that's
                    // not really an option here since this is always in math mode. As a way to fix
                    // that, each table is rendered inside an Ord atom's nucleus (unless that's changed
                    // with commands like \mathbin). The TeXbook includes an entire chapter pretty much
                    // dedicated to this command (pg. 231) and how it parses its argument and whatnot,
                    // so look there if the comments don't explain why something is happening.

                    var halignSym = Symbol();
                    e.mouth.saveState(halignSym);

                    // First, make sure the argument starts with an opening brace.
                    var token = e.mouth.eat();
                    if (!token || token.cat != data.cats.open) {
                        this.invalid = true;
                        this.recognized = true;
                        e.mouth.loadState(halignSym);
                        return [this];
                    }

                    var preamble = [[[]]],
                        repeatAt = -1,
                        tabSkips = [new GlueReg(e.scopes.last.registers.named.tabskip)],
                        globalTabSkip = false;
                    // The preamble has to be parsed now. Only five tokens are actually looked at, the
                    // rest stay in the preamble unexpanded and are added to each cell directly.
                    while (true) {
                        var token = e.mouth.eat('pre space');

                        if (!token) {
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(halignSym);
                            return [this];
                        } else if (token.type == 'command' || token.type == 'character' && token.car == data.cats.active) {
                            var macro = token.type == 'command' ? e.scopes.last.defs.primitive[token.name] || e.scopes.last.defs.macros[token.name] || e.scopes.last.registers.named[token.name] : e.scopes.last.defs.active[token.char];

                            if (!macro) {
                                // If the macro doesn't exist, just add it to preamble list since it might be de-
                                // fined by the time the preamble is evaluated.
                                (preamble[preamble.length - 1][1] || preamble[preamble.length - 1][0]).push(token);
                                continue;
                            } else if (macro === data.defs.primitive.cr || macro.isLet && macro.original === data.defs.primitive.cr) {
                                // If \cr is found, the end of the row was found and the preamble is done. Make
                                // sure the preamble has at least one complete column.
                                if (preamble[preamble.length - 1][1]) {
                                    // Add one more tabskip entry for the end of the table.
                                    tabSkips.push(new GlueReg(e.scopes.last.registers.named.tabskip));
                                    // Also change \tabskip back to the value it was at before the \halign. But also
                                    // take into consideration if a \global definition was made. If there was one,
                                    // change it to the latest \global definition.
                                    var glue = globalTabSkip || tabSkips[0],
                                        tabskip = e.scopes.last.registers.named.tabskip;
                                    tabskip.start.sp.value = glue.start.sp.value;
                                    tabskip.start.em.value = glue.start.em.value;
                                    if (glue.stretch.type == 'infinite dimension') tabskip.stretch = new InfDimen(glue.stretch.number.value, glue.stretch.magnitude.value);
                                    else tabskip.stretch = new DimenReg(glue.stretch.sp.value, glue.stretch.em.value);
                                    if (glue.shrink.type == 'infinite dimension') tabskip.shrink = new InfDimen(glue.shrink.number.value, glue.shrink.magnitude.value);
                                    else tabskip.shrink = new DimenReg(glue.shrink.sp.value, glue.shrink.em.value);
                                    break;
                                } else {
                                    this.invalid = true;
                                    this.recognized = true;
                                    e.mouth.loadState(halignSym);
                                    return [this];
                                }
                            } else if (macro === e.scopes.last.registers.named.tabskip) {
                                // If \tabskip is found, it should automatically be treated like a definition since
                                // it controls the spacing between rows. An optional space and some glue are looked
                                // for to set it. The definition is only local to the \halign; after the \halign,
                                // \tabskip is reset to its previous value.

                                var tabSkipDef = Symbol();
                                e.mouth.saveState(tabSkipDef);

                                var optEquals = e.mouth.eat();
                                if (!optEquals || optEquals.type != 'character' || optEquals.char != '=' || optEquals.cat != data.cats.all) optEquals && e.mouth.revert();

                                var glue = e.mouth.eat('glue');
                                if (!glue) {
                                    // If no glue was found to set \tabskip to, the \tabskip is left in the preamble so
                                    // that it'll be parsed later when the preamble gets actually evaluated. In normal
                                    // TeX, an error would be thrown if there's a random register without a definition.
                                    // In this version though, since it reports errors as invalid tokens instead of ab-
                                    // orting the whole thing, that's a lot harder to keep track of. The \tabskip is
                                    // just left alone without aborting the whole \halign.
                                    e.mouth.loadState(tabSkipDef);
                                    (preamble[preamble.length - 1][1] || preamble[preamble.length - 1][0]).push(token);
                                    continue;
                                }
                                // If a glue was found, \tabskip is set to its value temporarily. After the pre-
                                // amble is done parsing, \tabskip is returned to the value it had before the
                                // \halign. The definition might also be \global though if \globaldefs is positive.
                                var tabskip = e.scopes.last.registers.named.tabskip;
                                tabskip.start.sp.value = glue.start.sp.value;
                                tabskip.start.em.value = glue.start.em.value;
                                if (glue.stretch.type == 'infinite dimension') tabskip.stretch = new InfDimen(glue.stretch.number.value, glue.stretch.magnitude.value);
                                else tabskip.stretch = new DimenReg(glue.stretch.sp.value, glue.stretch.em.value);
                                if (glue.shrink.type == 'infinite dimension') tabskip.shrink = new InfDimen(glue.shrink.number.value, glue.shrink.magnitude.value);
                                else tabskip.shrink = new DimenReg(glue.shrink.sp.value, glue.shrink.em.value);
                                if (e.scopes.last.registers.named.globaldefs.value > 0) {
                                    globalTabSkip = new GlueReg(tabskip);
                                    while (tabskip.parent) {
                                        tabskip = tabskip.parent;
                                        tabskip.start.sp.value = glue.start.sp.value;
                                        tabskip.start.em.value = glue.start.em.value;
                                        if (glue.stretch.type == 'infinite dimension') tabskip.stretch = new InfDimen(glue.stretch.number.value, glue.stretch.magnitude.value);
                                        else tabskip.stretch = new DimenReg(glue.stretch.sp.value, glue.stretch.em.value);
                                        if (glue.shrink.type == 'infinite dimension') tabSkips.shrink = new InfDimen(glue.shrink.number.value, glue.shrink.magnitude.value);
                                        else tabskip.shrink = new DimenReg(glue.shrink.sp.value, glue.shrink.em.value);
                                    }
                                }
                                continue;
                            } else if (macro === data.defs.primitive.span || macro.isLet && macro.original === data.defs.primitive.span) {
                                // \span is like the opposite of \noexpand. Here, all the tokens are being skipped
                                // over except a select few. \span will expand the next token using `Mouth.expand'.
                                var next = e.mouth.eat();

                                if (!next) {
                                    this.invalid = true;
                                    this.recognized = true;
                                    e.mouth.loadState(halignSym);
                                    return [this];
                                }
                                var expansion = e.mouth.expand(next, e.mouth);
                                if (expansion.length == 1 && expansion[0] === next && next.invalid) {
                                    this.invalid = true;
                                    this.recognized = true;
                                    e.mouth.loadState(halignSym);
                                    return [this];
                                }
                                e.mouth.queue.unshift.apply(e.mouth.queue, expansion);
                                continue;
                            } else if (macro.isLet && macro.original.replacement[0] && macro.original.replacement[0].cat == data.cats.param) {
                                // A parameter token was found. It indicates where the text of each column should
                                // go.
                                if (preamble[preamble.length - 1][1]) {
                                    // A parameter token was already found for the current column, which makes this
                                    // preamble cell invalid.
                                    this.invalid = true;
                                    this.recognized = true;
                                    e.mouth.loadState(halignSym);
                                    return [this];
                                }
                                preamble[preamble.length - 1][1] = [];
                                continue;
                            } else if (macro.isLet && macro.original.replacement[0] && macro.original.replacement[0].cat == data.cats.alignment) {
                                // A tab alignment token was found. It indicates the end of the cell. If the previ-
                                // ous cell is empty, it indicates that all the cells from here on out will be re-
                                // peated indefinitely, as much as the columns in the table need them.
                                if (!~repeatAt && !preamble[preamble.length - 1][0].length && !preamble[preamble.length - 1][1]) {
                                    // The previous cell was empty. Set the `repeatAt' variable to the current length
                                    // of `preamble' to indicate that all the cells after `repeatAt' are repeatable.
                                    repeatAt = preamble.length - 1;
                                    // Instead of creating a new cell for the preamble, the current one is used since
                                    // it's still empty.
                                } else {
                                    if (preamble[preamble.length - 1][1]) {
                                        // The previous cell was complete. Make a new one.
                                        preamble.push([[]]);
                                        // This adds another entry to the `tabSkips' array. It'll control the spacing be-
                                        // tween the current row and the next. It's added using a blank column with nothing
                                        // but the space specified by \tabskip.
                                        tabSkips.push(new GlueReg(e.scopes.last.registers.named.tabskip));
                                    } else {
                                        // The last cell doesn't include a parameter token, which makes the cell an invalid
                                        // preamble.
                                        this.invalid = true;
                                        this.recognized = true;
                                        e.mouth.loadState(halignSym);
                                        return [this];
                                    }
                                }
                                continue;
                            }
                        } else {
                            if (token.cat == data.cats.param) {
                                // This is copied from above.
                                if (preamble[preamble.length - 1][1]) {
                                    this.invalid = true;
                                    this.recognized = true;
                                    e.mouth.loadState(halignSym);
                                    return [this];
                                }
                                preamble[preamble.length - 1][1] = [];
                                continue;
                            } else if (token.cat == data.cats.alignment) {
                                // This too.
                                if (!~repeatAt && !preamble[preamble.length - 1][0].length && !preamble[preamble.length - 1][1]) {
                                    repeatAt = preamble.length - 1;
                                } else {
                                    if (preamble[preamble.length - 1][1]) {
                                        preamble.push([[]]);
                                        tabSkips.push(new GlueReg(e.scopes.last.registers.named.tabskip));
                                    } else {
                                        this.invalid = true;
                                        this.recognized = true;
                                        e.mouth.loadState(halignSym);
                                        return [this];
                                    }
                                }
                                continue;
                            } else if (token.cat == data.cats.whitespace && !preamble[preamble.length - 1][0].length && !preamble[preamble.length - 1][1]) {
                                // If a whitespace token is found immediately after an alignment character, it is
                                // ignored to allow for line breaks right after them.
                                continue;
                            }
                        }
                        (preamble[preamble.length - 1][1] || preamble[preamble.length - 1][0]).push(token);
                    }

                    // Now that the preamble has finished parsing, now comes the actual body of the
                    // table. But instead of parsing the body here, it's parsed a the top level parser
                    // since that's the only place where tokens like ^, _, #, etc. can be dealt with
                    // correctly. A special scope is created to house all the tokens inside the table's
                    // body. When the scope is closed, instead of being added as a regular Ord atom
                    // a token list nucleus, the table is compiled into an array and stored as a spec-
                    // ial object in an Ord atom's nucleus.

                    // This ignored atom is used in case the \halign scope is never closed, similar to
                    // how a regular group is made. If the scope is never closed, the token is marked
                    // as invalid. Otherwise, it's taken out of the final token list.
                    var atom = {
                        type: 'atom',
                        atomType: 0,
                        nucleus: (this.type == 'command' ? this.escapeChar + this.name : this.char).split('').map(function(char) {
                            return {
                                type: 'atom',
                                atomType: 0,
                                nucleus: {
                                    type: 'symbol',
                                    char: char,
                                    code: char.charCodeAt(0)
                                },
                                superscript: null,
                                subscript: null
                            };
                        }),
                        superscript: null,
                        subscript: null,
                        ignore: true
                    }

                    e.openGroups.push(atom);
                    e.contexts.push('scope');
                    new e.Scope();
                    e.scopes.last.tokens.push(atom);
                    // `isHalign' marks the scope so that the outside parser will know to expect tokens
                    // like & and what to do when the scope is closed.
                    e.scopes.last.isHalign = true;
                    // This is where the table cells will be stored while they are being parsed. Each
                    // item in the array will be a row. Each row will be an array, with each item in
                    // there being an object representing the data for that cell.
                    e.scopes.last.cellData = [];
                    // Now store the info that was gotten here on the scope as well (the preamble and
                    // tabskips and stuff).
                    e.scopes.last.preamble = preamble;
                    e.scopes.last.repeatPreambleAt = repeatAt;
                    e.scopes.last.tabSkips = tabSkips;
                    // This will keep track of any \noalign space between rows.
                    e.scopes.last.noAligns = [];
                    // Now that the scope has been set up, the mouth spits the last eaten \cr back out.
                    // That's because each table cell needs to have its own scope. The only way that
                    // happens is inside the \cr function definition, and after each alignment token.
                    // Spitting the \cr back out lets the parser find it naturally and expand it, which
                    // sets up the scope for the first table cell.
                    e.mouth.revert();
                    // The table data is still stored in the mouth, so this primitive doesn't actually
                    // expand to anything.
                    return [];
                }),
                hbox: new Primitive('hbox', function(e) {
                    // So even though boxes don't really exist in this version of TeX, \hbox is in-
                    // cluded so that fixed-size blocks of text can still be rendered. Normally, \hbox
                    // would create a new horizontal box, usually with characters in it. After the
                    // "\hbox", you would be able to add "to" or "spread". The "to" would set the width
                    // of the box, disregarding whether the characters inside it would overflow or not.
                    // The "spread" would first render the box like normal, and then add on a set width
                    // so that the width can still be altered by its contents. This version of TeX uses
                    // HTML, so boxes aren't really a thing here. \hbox here acts like a single-celled
                    // \halign when it's created (so \hfil will still work inside it), but it's width
                    // may be changed. If a \hbox here doesn't have a "to" or "spread" associated with
                    // it, it's parsed as a regular group of tokens since it would have the same width.
                    // A custom "hbox" token is created that'll be parsed later in the HTML generator
                    // so it will have the correct width.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var hboxSym = Symbol();
                    e.mouth.saveState(hboxSym);

                    var spread, to;

                    // First, a "t" (for "to") or "s" (for "spread") is looked for. If it doesn't find
                    // one, the token should be an opening character. If it is, token is spit back out
                    // and the function returns. The opening token and its closing token will all be
                    // parsed as a regular group of tokens. If the token wasn't an opening token, the
                    // \hbox is returned invalid.
                    while (true) {
                        var token = e.mouth.eat();

                        if (!token) {
                            this.invalid = true;
                            this.recognized = true;
                            return [this];
                        }

                        if (token.type == 'command' || token.type == 'character' && token.cat == data.cats.active) {
                            var macro = token.type == 'command' ? e.scopes.last.defs.primitive[token.name] || e.scopes.last.defs.macros[token.name] : e.scopes.last.defs.active[token.char];
                            if (macro && (macro === data.defs.primitive.relax || macro.proxy && macro.original === data.defs.primitive.relax)) {
                                break;
                            }
                            var expansion = e.mouth.expand(token, e.mouth);
                            e.mouth.queue.unshift.apply(e.mouth.queue, expansion);
                            continue;
                        } else if (token.type == 'character' && (token.char == 't' || token.char == 'T')) {
                            // A "t" was found. Make sure the next token is an "o" and then a dimension.
                            var o = e.mouth.eat('pre space');
                            if (o && o.type == 'character' && (o.char == 'o' || token.char == 'O') && token.cat != data.cats.active) {
                                var dimen = e.mouth.eat('dimension');
                                if (dimen) {
                                    to = dimen;
                                    break;
                                } else {
                                    this.invalid = true;
                                    this.recognized = true;
                                    e.mouth.loadState(hboxSym);
                                    return [this];
                                }
                            } else {
                                this.invalid = true;
                                this.recognized = true;
                                e.mouth.loadState(hboxSym);
                                return [this];
                            }
                        } else if (token.type == 'character' && (token.char == 's' || token.char == 'S')) {
                            // An "s" was found. Make sure the next five tokens are "pread" and then a dimen-
                            // sion.
                            var p = e.mouth.eat(),
                                r = e.mouth.eat(),
                                E = e.mouth.eat(),
                                a = e.mouth.eat(),
                                d = e.mouth.eat();
                            if (!p || p.type != 'character' || p.char != 'p' && p.char != 'P' || p.cat == data.cats.active ||
                                !r || r.type != 'character' || r.char != 'r' && r.char != 'R' || r.cat == data.cats.active ||
                                !E || E.type != 'character' || E.char != 'e' && E.char != 'E' || E.cat == data.cats.active ||
                                !a || a.type != 'character' || a.char != 'a' && a.char != 'A' || a.cat == data.cats.active ||
                                !d || d.type != 'character' || d.char != 'd' && d.char != 'D' || d.cat == data.cats.active) {
                                this.invalid = true;
                                this.recognized = true;
                                e.mouth.loadState(hboxSym);
                                return [this];
                            }
                            var dimen = e.mouth.eat('dimension');
                            if (dimen) {
                                spread = dimen;
                                break;
                            } else {
                                this.invalid = true;
                                this.recognized = true;
                                e.mouth.loadState(hboxSym);
                                return [this];
                            }
                        } else if (token.type == 'character' && token.cat == data.cats.open) {
                            // Spit the token back out and let the parser make a group from the rest of the
                            // argument.
                            e.mouth.revert();
                            return [];
                        } else {
                            // Some invalid token was found. The argument to \hbox wasn't correct and it should
                            // return invalid.
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(hboxSym);
                            return [this];
                        }
                    }
                    // Make sure the next token is an opening group token to validate that \hbox got
                    // its proper argument.
                    var open = e.mouth.preview();
                    if (!open || open.type != 'character' || open.cat != data.cats.open) {
                        this.invalid = true;
                        this.recognized = true;
                        e.mouth.loadState(hboxSym);
                        return [this];
                    }

                    // If the "to" or "spread" value is 0, then it's the same thing as if it had just
                    // been passed as \hbox{}, which means the tokens can be parsed as a regular group.
                    if (!spread && to.sp.value == 0 && to.em.value == 0 || !to && spread.sp.value == 0 && spread.em.value == 0) {
                        return [];
                    }
                    // The next group of tokens will be parsed like normal and be placed in their own
                    // atom. A temporary token is created so that the next group atom after it (i.e.
                    // the argument to \hbox) will be placed inside an \hbox token. It's like the same
                    // as how \accent behaves.
                    e.tokens.push({
                        type: 'box wrapper',
                        value: 'horizontal',
                        to: to,
                        spread: spread,
                        token: this
                    });
                    return [];
                }),
                hfil: new Primitive('hfil', function(e) {
                    // \hfil is exactly the same as "\hskip0pt plus 1fil\relax". TeX sets it up to be a
                    // primitive for efficiency reason, even though it could be implemented like a mac-
                    // ro. Since it doesn't have a starting value, it'll be completely ignored outside
                    // of a table or fraction or \hbox since only in those cases are flexboxes used.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    e.tokens.push({
                        type: 'glue',
                        glue: new GlueReg(new DimenReg(0), new InfDimen(1, 1), new DimenReg(0))
                    });
                    return [];
                }),
                hfill: new Primitive('hfill', function(e) {
                    // This is exactly the same as \hfil but with 1fill of stretchability instead of
                    // 1fil.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    e.tokens.push({
                        type: 'glue',
                        glue: new GlueReg(new DimenReg(0), new InfDimen(1, 2), new DimenReg(0))
                    });
                    return [];
                }),
                hskip: new Primitive('hskip', function(e) {
                    // This is basically a glue version of \kern. When the HTML is rendered glues are
                    // essentially treated like regular dimensions anyway, so \hskip and \kern pretty
                    // much are the exact same thing except their argument types.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var glue = e.mouth.eat('glue');
                    if (!glue) {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }
                    e.tokens.push({
                        type: 'glue',
                        glue: glue
                    });
                    return [];
                }),
                if: new Primitive('if', function(e) {
                    // \if is mostly used for macros. It allows for some form of logic that affects how
                    // a macro will behave in certain situations. \if is only one of 15 possible `if'
                    // block starters. This \if will compare characters. Any macros after a \if will be
                    // expanded until the first two unexpandable tokens are found. If the unexpandable
                    // token is a command (a primitive that can't be expanded), then it will match with
                    // any other unexpandable command and will return true. If one of the tokens is a
                    // character, only the actual character is compared, independent of the catcodes.
                    // If \def\star{*}, \let\asterisk=*, and \def\amp{&}, then the following are true:
                    // \if**, \if*\star, \if\star\asterisk, \if\def\let
                    // The following though are all false:
                    // \if*\let, \if\star\amp, \if\amp\def, \if\asterisk&
                    // After an \if command is determined to be either true or false, the text after
                    // determines what happens as a result. If true, the text immediately following the
                    // two compared tokens are used, all the way until a \fi or \else is encountered.
                    // If false, the text after a \else is executed until the first \fi. If there is
                    // no \else (\if ... \fi), then nothing is executed. While skipping over tokens
                    // to find a \else or \fi, \if commands and \fi are nested to prevent breaking if
                    // blocks. For example, \if01 \if ... \fi ... \else ... \fi will first evaluate to
                    // false. The text following the "01" will be skipped. Since there is a \if inside,
                    // the next \fi is also skipped over until the \else is found, and execution re-
                    // sumes from there. If the first \if had not been found, the first \fi would not
                    // have been skipped and it would have appeared like a regular if block. The \else
                    // wouldn't have been found until later, and would throw an error for being in the
                    // wrong context. Also note that when skipping over text, ONLY the \if groups are
                    // considered. That means you are allowed to have unbalanced nesting with { and }
                    // and still have it work correctly (as long as those are balanced out somewhere
                    // outside the \if). All the other version of \if that test for different things
                    // are found below, after this function definition.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var ifSym = Symbol();
                    e.mouth.saveState(ifSym);

                    // First, the tokens after the \if have to be expanded, similar to how \edef re-
                    // cursively expands tokens.
                    var tokens = [],
                        noexpand = false;
                    while (tokens.length < 2) {
                        // Tokens are eaten and expanded recursively until the first two unexpandable to-
                        // kens are found. \noexpand allows for macros that would normally expand to be
                        // treated like a primitive in that they will match with any other unexpandable
                        // command.
                        var token = e.mouth.eat('pre space');

                        if (!token) {
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(ifSym);
                            return [this];
                        } else if (token.type == 'character' && token.cat == data.cats.whitespace && tokens.length == 0) {
                            // Whitespace isn't allowed right after the \if command, but IS allowed after one
                            // of the tokens have been parsed.
                            continue;
                        } else if (token.type == 'character' && tokens.cat != data.cats.active) {
                            tokens.push(token);
                            noexpand = false;
                        } else if (noexpand) {
                            tokens.push(token);
                            noexpand = false;
                        } else if (token.type == 'command' || token.type == 'character' && token.cat == data.cats.active) {
                            // If the command refers to a register, it is kept unexpanded and added to the list
                            // of tokens immediately.
                            if (token.name in e.scopes.last.registers.named) {
                                tokens.push(token);
                                continue;
                            }

                            // A macro or active character was found. Look up its definition first.
                            var macro = token.type == 'command' ? e.scopes.last.defs.primitive[token.name] || e.scopes.last.defs.macros[token.name] : e.scopes.last.defs.active[token.char];

                            // If it doesn't have a definition, return invalid.
                            if (!macro) {
                                this.invalid = true;
                                this.recognized = true;
                                e.mouth.loadState(ifSym);
                                return [this];
                            }
                            // If an expandable primitive is found, expand it to get some tokens.
                            if ((macro === data.defs.primitive.the          || macro.proxy && macro.original === data.defs.primitive.the)          ||
                                (macro === data.defs.primitive.expandafter  || macro.proxy && macro.original === data.defs.primitive.expandafter)  ||
                                (macro === data.defs.primitive.number       || macro.proxy && macro.original === data.defs.primitive.number)       ||
                                (macro === data.defs.primitive.romannumeral || macro.proxy && macro.original === data.defs.primitive.romannumeral) ||
                                (macro === data.defs.primitive.csname       || macro.proxy && macro.original === data.defs.primitive.csname)       ||
                                (macro === data.defs.primitive.string       || macro.proxy && macro.original === data.defs.primitive.string)       ||
                                (macro === data.defs.primitive.if           || macro.isLet && macro.original === data.defs.primitive.if)           ||
                                (macro === data.defs.primitive.ifcase       || macro.isLet && macro.original === data.defs.primitive.ifcase)       ||
                                (macro === data.defs.primitive.ifcat        || macro.isLet && macro.original === data.defs.primitive.ifcat)        ||
                                (macro === data.defs.primitive.ifdim        || macro.isLet && macro.original === data.defs.primitive.ifdim)        ||
                                (macro === data.defs.primitive.ifeof        || macro.isLet && macro.original === data.defs.primitive.ifeof)        ||
                                (macro === data.defs.primitive.iffalse      || macro.isLet && macro.original === data.defs.primitive.iffalse)      ||
                                (macro === data.defs.primitive.ifodd        || macro.isLet && macro.original === data.defs.primitive.ifodd)        ||
                                (macro === data.defs.primitive.ifnum        || macro.isLet && macro.original === data.defs.primitive.ifnum)        ||
                                (macro === data.defs.primitive.ifhmode      || macro.isLet && macro.original === data.defs.primitive.ifhmode)      ||
                                (macro === data.defs.primitive.ifinner      || macro.isLet && macro.original === data.defs.primitive.ifinner)      ||
                                (macro === data.defs.primitive.ifmmode      || macro.isLet && macro.original === data.defs.primitive.ifmmode)      ||
                                (macro === data.defs.primitive.iftrue       || macro.isLet && macro.original === data.defs.primitive.iftrue)       ||
                                (macro === data.defs.primitive.ifvmode      || macro.isLet && macro.original === data.defs.primitive.ifvmode)      ||
                                (macro === data.defs.primitive.ifvoid       || macro.isLet && macro.original === data.defs.primitive.ifvoid)       ||
                                (macro === data.defs.primitive.ifx          || macro.isLet && macro.original === data.defs.primitive.ifx)) {
                                var expansion = e.mouth.expand(token, e.mouth);
                                if (expansion.length == 1 && expansion[0] === token && token.invalid) {
                                    this.invalid = true;
                                    this.recognized = true;
                                    e.mouth.loadState(ifSym);
                                    return [this];
                                }
                                e.mouth.queue.unshift.apply(e.mouth.queue, expansion);
                                continue;
                            } else if (macro === data.defs.primitive.noexpand || macro.proxy && macro.original === data.defs.primitive.noexpand) {
                                noexpand = true;
                                continue;
                            }

                            // If the macro is any other primitive, don't expand it. Add it directly to the to-
                            // ken list.
                            if (macro instanceof Primitive || macro.proxy && macro.original instanceof Primitive) {
                                tokens.push(token);
                                continue;
                            }

                            // If it's actually a macro, then it has to be expanded. \edef has its own version
                            // `Mouth.expand' since it needs to take care of parameter tokens (#), but that's
                            // not the case here. Instead, the regular `expand' function is used.
                            var expansion = e.mouth.expand(token, e.mouth);
                            if (expansion.length == 1 && expansion[0] ==- token && token.invalid) {
                                this.invalid = true;
                                this.recognized = true;
                                e.mouth.loadState(ifSym);
                                return [this];
                            }
                            e.mouth.queue.unshift.apply(e.mouth.queue, expansion);
                        } else tokens.push(token);
                    }

                    // Since there are so many \if commands and they all end up doing the same thing
                    // (either using the the true replacement text or the false text), an `evalIf' fun-
                    // tion is used.
                    return evalIf.call(this, tokens[0].type == 'command' && tokens[1].type == 'command' || tokens[0].type == 'character' && tokens[0].char == tokens[1].char, e.mouth, e.scopes, ifSym);
                }),
                ifcase: new Primitive('ifcase', function(e) {
                    // \ifcase is a special version of \if that works like a `switch' in JavaScript.
                    // \ifcase will expect an integer after it. Then, there will be `case's that are
                    // executed depending on the value of the integer. For example, \ifcase 2 <case 0>
                    // \or <case 1> \or <case 2> \else <default> \fi. The \else acts like the `default'
                    // case in a JavaScript `switch'. This is the only "special" version of \if that
                    // accepts \or cases. All the other ones work similar to the regular \if in that
                    // they only allow \else and \fi.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var ifSym = Symbol();
                    e.mouth.saveState(ifSym);

                    // The integer to be checked is gotten first.
                    var int = e.mouth.eat('integer');
                    if (!int) {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    // `int' is the number of the case to expand. To look for that case, the "\or" com-
                    // mand is looked for `int' amount of times. If the case isn't found, the "\else"
                    // looked for. If there is no "\else", nothing is expanded.

                    // `isElse' is a boolean that tells whether the current context for the \ifcase is
                    // inside an \or inside \else. If it's in an \or block, then finding another \or
                    // command is valid TeX and means it's the end of the expansion. If it's in an
                    // \else block though, \or is invalid. `isElse' is set inside the `evalIf' function
                    // below since that's where token skipping is evaluated.
                    var tokens = [],
                        isElse = false;
                    int = int.value;
                    // If `int' is negative, only the \else is evaluated.
                    if (int < 0) skipUntil('else');
                    else {
                        for (; int > 0 && !isElse; int--) skipUntil('or');
                    }

                    while (true) {
                        var token = e.mouth.eat();

                        if (!token) {
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(stateSymbol);
                            return [this];
                        } else if (token.type == 'command' || token.type == 'character' && token.cat == data.cats.active) {
                            var macro = token.type == 'command' ? e.scopes.last.defs.primitive[token.name] || e.scopes.last.defs.macros[token.name] : e.scopes.last.defs.active[token.char];
                            // There is no \else special if block here because it should have already been e-
                            // valuated. Instead, it's expanded naturally, which will mark it as invalid for
                            // being in the wrong context.
                            if (macro && (macro === data.defs.primitive.fi || macro.isLet && macro.original === data.defs.primitive.fi)) return tokens;
                            else if (!isElse && macro && (macro === data.defs.primitive.or || macro.isLet && macro.original === data.defs.primitive.or || macro === data.defs.primitive.else || macro.isLet && macro.original === data.defs.primitive.else)) {
                                skipUntil('fi');
                                continue;
                            }
                            var expansion = e.mouth.expand(token, e.mouth);
                            e.mouth.queue.unshift.apply(e.mouth.queue, expansion);
                        } else {
                            tokens.push(token);
                        }
                    }

                    // This is like the same function from `evalIf' except it looks for \or as well.
                    function skipUntil(elseOrFi) {
                        while (true) {
                            var token = e.mouth.eat();

                            if (!token) {
                                return;
                            } else if (token.type == 'command' || token.type == 'character' && token.cat === data.cats.active) {
                                var macro = token.type == 'command' ? e.scopes.last.defs.primitive[token.name] || e.scopes.last.defs.macros[token.name] : e.scopes.last.defs.active[token.char];

                                if (!macro) continue;

                                // Test if the macro is a \if (or \let to be one). If it is, `skipUntil' is called
                                // recursively until a \fi is found. Then it'll return to the current level of
                                // skipping.
                                if ((macro === data.defs.primitive.if      || macro.isLet && macro.original === data.defs.primitive.if)      ||
                                    (macro === data.defs.primitive.ifcase  || macro.isLet && macro.original === data.defs.primitive.ifcase)  ||
                                    (macro === data.defs.primitive.ifcat   || macro.isLet && macro.original === data.defs.primitive.ifcat)   ||
                                    (macro === data.defs.primitive.ifdim   || macro.isLet && macro.original === data.defs.primitive.ifdim)   ||
                                    (macro === data.defs.primitive.ifeof   || macro.isLet && macro.original === data.defs.primitive.ifeof)   ||
                                    (macro === data.defs.primitive.iffalse || macro.isLet && macro.original === data.defs.primitive.iffalse) ||
                                    (macro === data.defs.primitive.ifodd   || macro.isLet && macro.original === data.defs.primitive.ifodd)   ||
                                    (macro === data.defs.primitive.ifnum   || macro.isLet && macro.original === data.defs.primitive.ifnum)   ||
                                    (macro === data.defs.primitive.ifhmode || macro.isLet && macro.original === data.defs.primitive.ifhmode) ||
                                    (macro === data.defs.primitive.ifinner || macro.isLet && macro.original === data.defs.primitive.ifinner) ||
                                    (macro === data.defs.primitive.ifmmode || macro.isLet && macro.original === data.defs.primitive.ifmmode) ||
                                    (macro === data.defs.primitive.iftrue  || macro.isLet && macro.original === data.defs.primitive.iftrue)  ||
                                    (macro === data.defs.primitive.ifvmode || macro.isLet && macro.original === data.defs.primitive.ifvmode) ||
                                    (macro === data.defs.primitive.ifvoid  || macro.isLet && macro.original === data.defs.primitive.ifvoid)  ||
                                    (macro === data.defs.primitive.ifx     || macro.isLet && macro.original === data.defs.primitive.ifx)) {

                                    // `skipUntil' is called to look for the closing \fi.
                                    skipUntil('fi');
                                    // `skipUntil' does not absorb the \fi token, so it has to be eaten manually. If
                                    // there was no \fi token, then there must be NO tokens left, so `mouth.eat()'
                                    // won't do anything and the missing tokens will be token care of on the next loop.
                                    e.mouth.eat();
                                    continue;
                                }

                                // Now, if `elseOrFi' is "or", then check for an \or token. If an \or IS found, it
                                // is absorbed and the function returns.
                                if (elseOrFi == 'or' && (macro === data.defs.primitive.or || macro.isLet && macro.original === data.defs.primitive.or)) {
                                    return;
                                }

                                // If a \else is found and `elseOrFi' is "or", it counts as an \or. `ifElse' is set
                                // to true to signify the context is \else, not \or.
                                if ((elseOrFi == 'or' || elseOrFi == 'else') && (macro === data.defs.primitive.else || macro.isLet && macro.original === data.defs.primitive.else)) {
                                    isElse = true;
                                    return;
                                }

                                // If a \fi is found, the \fi is put back and the function returns.
                                if (macro === data.defs.primitive.fi || macro.isLet && macro.original === data.defs.primitive.fi) {
                                    e.mouth.revert();
                                    return;
                                }
                            }
                        }
                    }
                }),
                ifcat: new Primitive('ifcat', function(e) {
                    // \ifcat behaves exactly like \if except that only the catcodes are checked indep-
                    // endent of the characters.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var ifSym = Symbol();
                    e.mouth.saveState(ifSym);

                    // First, the tokens after the \ifcat have to be expanded, similar to how \edef re-
                    // cursively expands tokens.
                    var tokens = [],
                        noexpand = false;
                    while (tokens.length < 2) {
                        // Tokens are eaten and expanded recursively until the first two unexpandable to-
                        // kens are found. \noexpand allows for macros that would normally expand to be
                        // treated like a primitive in that they will match with any other unexpandable
                        // command.
                        var token = e.mouth.eat('pre space');

                        if (!token) {
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(ifSym);
                            return [this];
                        } else if (token.type == 'character' && token.cat == data.cats.whitespace && tokens.length == 0) {
                            // Whitespace isn't allowed right after the \if command, but IS allowed after one
                            // of the tokens have been parsed.
                            continue;
                        } else if (token.type == 'character' && tokens.cat != data.cats.active) {
                            tokens.push(token);
                            noexpand = false;
                        } else if (noexpand) {
                            tokens.push(token);
                            noexpand = false;
                        } else if (token.type == 'command' || token.type == 'character' && token.cat == data.cats.active) {
                            // If the command refers to a register, it is kept unexpanded and added to the list
                            // of tokens immediately.
                            if (token.name in e.scopes.last.registers.named) {
                                tokens.push(token);
                                continue;
                            }

                            // A macro or active character was found. Look up its definition first.
                            var macro = token.type == 'command' ? e.scopes.last.defs.primitive[token.name] || e.scopes.last.defs.macros[token.name] : e.scopes.last.defs.active[token.char];

                            // If it doesn't have a definition, return invalid.
                            if (!macro) {
                                this.invalid = true;
                                this.recognized = true;
                                e.mouth.loadState(ifSym);
                                return [this];
                            }
                            // If an expandable primitive is found, expand it to get some tokens.
                            if ((macro === data.defs.primitive.the          || macro.proxy && macro.original === data.defs.primitive.the)          ||
                                (macro === data.defs.primitive.expandafter  || macro.proxy && macro.original === data.defs.primitive.expandafter)  ||
                                (macro === data.defs.primitive.number       || macro.proxy && macro.original === data.defs.primitive.number)       ||
                                (macro === data.defs.primitive.romannumeral || macro.proxy && macro.original === data.defs.primitive.romannumeral) ||
                                (macro === data.defs.primitive.csname       || macro.proxy && macro.original === data.defs.primitive.csname)       ||
                                (macro === data.defs.primitive.string       || macro.proxy && macro.original === data.defs.primitive.string)       ||
                                (macro === data.defs.primitive.if           || macro.isLet && macro.original === data.defs.primitive.if)           ||
                                (macro === data.defs.primitive.ifcase       || macro.isLet && macro.original === data.defs.primitive.ifcase)       ||
                                (macro === data.defs.primitive.ifcat        || macro.isLet && macro.original === data.defs.primitive.ifcat)        ||
                                (macro === data.defs.primitive.ifdim        || macro.isLet && macro.original === data.defs.primitive.ifdim)        ||
                                (macro === data.defs.primitive.ifeof        || macro.isLet && macro.original === data.defs.primitive.ifeof)        ||
                                (macro === data.defs.primitive.iffalse      || macro.isLet && macro.original === data.defs.primitive.iffalse)      ||
                                (macro === data.defs.primitive.ifodd        || macro.isLet && macro.original === data.defs.primitive.ifodd)        ||
                                (macro === data.defs.primitive.ifnum        || macro.isLet && macro.original === data.defs.primitive.ifnum)        ||
                                (macro === data.defs.primitive.ifhmode      || macro.isLet && macro.original === data.defs.primitive.ifhmode)      ||
                                (macro === data.defs.primitive.ifinner      || macro.isLet && macro.original === data.defs.primitive.ifinner)      ||
                                (macro === data.defs.primitive.ifmmode      || macro.isLet && macro.original === data.defs.primitive.ifmmode)      ||
                                (macro === data.defs.primitive.iftrue       || macro.isLet && macro.original === data.defs.primitive.iftrue)       ||
                                (macro === data.defs.primitive.ifvmode      || macro.isLet && macro.original === data.defs.primitive.ifvmode)      ||
                                (macro === data.defs.primitive.ifvoid       || macro.isLet && macro.original === data.defs.primitive.ifvoid)       ||
                                (macro === data.defs.primitive.ifx          || macro.isLet && macro.original === data.defs.primitive.ifx)) {
                                var expansion = e.mouth.expand(token, e.mouth);
                                if (expansion.length == 1 && expansion[0] === token && token.invalid) {
                                    this.invalid = true;
                                    this.recognized = true;
                                    e.mouth.loadState(ifSym);
                                    return [this];
                                }
                                e.mouth.queue.unshift.apply(e.mouth.queue, expansion);
                                continue;
                            } else if (macro === data.defs.primitive.noexpand || macro.proxy && macro.original === data.defs.primitive.noexpand) {
                                noexpand = true;
                                continue;
                            }

                            // If the macro is any other primitive, don't expand it. Add it directly to the to-
                            // ken list.
                            if (macro instanceof Primitive || macro.proxy && macro.original instanceof Primitive) {
                                tokens.push(token);
                                continue;
                            }

                            // If it's actually a macro, then it has to be expanded. \edef has its own version
                            // `Mouth.expand' since it needs to take care of parameter tokens (#), but that's
                            // not the case here. Instead, the regular `expand' function is used.
                            var expansion = e.mouth.expand(token, e.mouth);
                            if (expansion.length == 1 && expansion[0] ==- token && token.invalid) {
                                this.invalid = true;
                                this.recognized = true;
                                e.mouth.loadState(ifSym);
                                return [this];
                            }
                            e.mouth.queue.unshift.apply(e.mouth.queue, expansion);
                        } else tokens.push(token);
                    }

                    // Now compare the catcode of the two tokens. If they're both commands, they match
                    // "catcodes" even though they don't have actual catcodes.
                    return evalIf.call(this, tokens[0].type == 'command' && tokens[1].type == 'command' || tokens[0].type == 'character' && tokens[0].cat == tokens[1].cat, e.mouth, e.scopes, ifSym);
                }),
                ifdim: new Primitive('ifdim', function(e) {
                    // \ifdim compares dimensions using a relational operator (<, >, or =). The syntax
                    // is \ifdim<dimension><operator><dimension>. If the tokens don't match the syntax,
                    // the \ifdim token is returned invalid.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var ifSym = Symbol();
                    e.mouth.saveState(ifSym);

                    // First, a dimension token is looked for.
                    var dim1 = e.mouth.eat('dimension');
                    if (!dim1) {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }
                    dim1 = dim1.sp.value + dim1.em.value * 12;

                    // The operator is either "<", "=", or ">" and controls how the two dimensions are
                    // compared.
                    var operator = e.mouth.eat();
                    if (!operator || (operator.cat == data.cats.active && (operator.char == '<' || operator.char == '=' || operator.char == '>'))) {
                        this.invalid = true;
                        this.recognized = true;
                        e.mouth.loadState(ifSym);
                        return [this];
                    }

                    // The second dimension is looked for now to be compared with the first later.
                    var dim2 = e.mouth.eat('dimension');
                    if (!dim2) {
                        this.invalid = true;
                        this.recognized = true;
                        e.mouth.loadState(ifSym);
                        return [this];
                    }
                    dim2 = dim2.sp.value + dim2.em.value * 12;

                    return evalIf.call(this, operator.char == '<' ? dim1 < dim2 : operator.char == '=' ? dim1 == dim2 : dim1 > dim2, e.mouth, e.scopes, ifSym);
                }),
                ifeof: new Primitive('ifeof', function(e) {
                    // Streams don't exist, so this primitive is 100% obsolete here and will always re-
                    // turn true. It's basically the same as \iftrue. It's only included for consisten-
                    // cy with real TeX.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var sym = Symbol();
                    e.mouth.saveState(sym);

                    return evalIf.call(this, true, e.mouth, e.scopes, sym);
                }),
                iffalse: new Primitive('iffalse', function(e) {
                    // This version of \if will ALWAYS evaluate to false. If there is an \else block,
                    // the code inside that will be executed. Otherwise, the \if block is skipped over
                    // and nothing happens. The reason it exists is for \newif and for when you need a
                    // \let that will evaluate to a falsy value. There is also an \iftrue command that
                    // does the complete opposite of this command.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var sym = Symbol();
                    e.mouth.saveState(sym);

                    return evalIf.call(this, false, e.mouth, e.scopes, sym);
                }),
                ifodd: new Primitive('ifodd', function(e) {
                    // \ifodd checks if the next integer is odd.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var ifSym = Symbol();
                    e.mouth.saveState(ifSym);

                    // The integer to be checked is gotten first.
                    var int = e.mouth.eat('integer');
                    if (!int) {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    return evalIf.call(this, int.value % 2 == 1, e.mouth, e.scopes, ifSym);
                }),
                ifnum: new Primitive('ifnum', function(e) {
                    // \ifnum is the integer version of \ifdim. It will compare two integers using the
                    // three relational operator <, >, and =.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var ifSym = Symbol();
                    e.mouth.saveState(ifSym);

                    // First, an integer token is looked for.
                    var int1 = e.mouth.eat('integer');
                    if (!int1) {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    // The operator is either "<", "=", or ">" and controls how the two integers are
                    // compared.
                    var operator = e.mouth.eat();
                    if (!operator || (operator.cat == data.cats.active && (operator.char == '<' || operator.char == '=' || operator.char == '>'))) {
                        this.invalid = true;
                        this.recognized = true;
                        e.mouth.loadState(ifSym);
                        return [this];
                    }

                    // The second integer is looked for now to be compared with the first later.
                    var int2 = e.mouth.eat('integer');
                    if (!int2) {
                        this.invalid = true;
                        this.recognized = true;
                        e.mouth.loadState(ifSym);
                        return [this];
                    }

                    return evalIf.call(this, operator.char == '<' ? int1.value < int2.value : operator.char == '=' ? int1.value == int2.value : int1.value > int2.value, e.mouth, e.scopes, ifSym);
                }),
                ifhmode: new Primitive('ifhmode', function(e) {
                    // Normally, \ifhmode will check if TeX is in horizontal mode. This version of TeX
                    // though is always in math mode, so this is always false. It's synonymous with
                    // \iffalse.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var sym = Symbol();
                    e.mouth.saveState(sym);

                    return evalIf.call(this, false, e.mouth, e.scopes, sym);
                }),
                ifinner: new Primitive('ifinner', function(e) {
                    // This checks if the current math context is inline or displayed. Displayed math
                    // contexts are delimited by "$$" (or "\[") while inline ones are delimited by $
                    // (or "\("). It doesn't matter if a \displaystyle-type command has changed the
                    // style. $$\textstyle ... $$ still counts as displayed and \ifinner would return
                    // false in that case, even though it's in inline style mode.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var sym = Symbol();
                    e.mouth.saveState(sym);

                    return evalIf.call(this, e.style == 'inline', e.mouth, e.scopes, sym);
                }),
                ifmmode: new Primitive('ifmmode', function(e) {
                    // This is supposed to check if TeX is in math mode. It's ALWAYS in math mode here
                    // though, so this is always true.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var sym = Symbol();
                    e.mouth.saveState(sym);

                    return evalIf.call(this, true, e.mouth, e.scopes, sym);
                }),
                iftrue: new Primitive('iftrue', function(e) {
                    // The exact opposite of \iffalse.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var sym = Symbol();
                    e.mouth.saveState(sym);

                    return evalIf.call(this, true, e.mouth, e.scopes, sym);
                }),
                ifvmode: new Primitive('ifvmode', function(e) {
                    // \ifvmode checks for vertical mode, which is never true in this version of TeX.
                    // This is always false.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var sym = Symbol();
                    e.mouth.saveState(sym);

                    return evalIf.call(this, false, e.mouth, e.scopes, sym);
                }),
                ifvoid: new Primitive('ifvoid', function(e) {
                    // \ifvoid would normally check if a box is empty. Boxes though don't exist here
                    // because everything is rendered in HTML. This is always true.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var sym = Symbol();
                    e.mouth.saveState(sym);

                    return evalIf.call(this, true, e.mouth, e.scopes, sym);
                }),
                ifx: new Primitive('ifx', function(e) {
                    // ifx compares characters and catcodes. If the two tokens are both characters,
                    // they must be the same exact token to evaluate to true. \ifx does not expand
                    // macros though. If two macros are found, their top-level expansion is compared.
                    // If \def\a{\b} \def\b{\d} \def\c{\d}, \ifx\b\c is true, but \ifx\a\b is false.
                    // Even though \a's top level expansion is \b, \b's top level expansion is \c. \b
                    // and \c are what are compared, which evaluates to false.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var ifSym = Symbol();
                    e.mouth.saveState(ifSym);

                    // The first two tokens are compared without expansion.
                    var token1 = e.mouth.eat();
                    if (!token1) {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var token2 = e.mouth.eat('pre space');
                    if (!token2) {
                        this.invalid = true;
                        this.recognized = true;
                        e.mouth.loadState(ifSym);
                        return [this];
                    }

                    // Command tokens are expanded to their corresponding macros/primitives.
                    token1 = token1.type == 'command' ? e.scopes.last.defs.primitive[token1.name] || e.scopes.last.defs.macros[token1.name] :
                             token1.type == 'character' && token1.cat == data.cats.active ? e.scopes.last.defs.active[token1.char] :
                             token1;
                    if (token1 && token1.proxy) token1 = token1.original;
                    token2 = token2.type == 'command' ? e.scopes.last.defs.primitive[token2.name] || e.scopes.last.defs.macros[token2.name] :
                             token2.type == 'character' && token2.cat == data.cats.active ? e.scopes.last.defs.active[token2.char] :
                             token2;
                    if (token2 && token2.proxy) token2 = token2.original;

                    // If both tokens were command, but don't have definitions, then they count as
                    // matching and the \ifx evaluates to true.
                    if (!token1 && !token2) return evalIf.call(this, true, e.mouth, e.scopes, ifSym);
                    // If only one token is undefined, then it must not be a match and it has to eval-
                    // uate to false. This also gets rid of any errors later pertaining to getting
                    // properties on `undefined'. Also, if the types on the tokens don't match, then it
                    // must also evaluate to false.
                    if (!token1 || !token2 || token1.type != token2.type) return evalIf.call(this, false, e.mouth, e.scopes, ifSym);
                    // Now, if the two tokens are character, compare charCodes and catcodes.
                    if (token1.type == 'character') return evalIf.call(this, token1.char == token2.char && token1.cat == token2.cat, e.mouth, e.scopes, ifSym);
                    // If the two tokens are primitives, check that they reference the same thing.
                    if (token1.type == 'primitive') return evalIf.call(this, token1 === token2, e.mouth, e.scopes, ifSym);
                    // The two tokens must be macros. Their parameter and replacement tokens have to be
                    // compared. Check that their tokens first off at least have the same length.
                    if (token1.parameters.length != token2.parameters.length || token1.replacement.length != token2.replacement.length) return evalIf.call(this, false, e.mouth, e.scopes, ifSym);
                    // Now each token in the first token's parameters is compared with the correspond-
                    // ing token in the second token's parameters. If a command token is found, only
                    // the name of the token is compared, not what it expands to. For example, if
                    // \def\cmdone{hi} \let\cmdtwo=\cmdone and those two tokens are compared against
                    // each other, it will evaluate to false. Even though \cmdtwo is essentially exact-
                    // ly the same as \cmdone, only the names are checked. That makes sense considering
                    // macros are expanded later and \cmdtwo may be equal to \cmdone now, but may be
                    // different when the macro is actually expanded.
                    for (var i = 0, l = token1.parameters.length; i < l; i++) {
                        if (token1.parameters[i].type == 'character' && token1.parameters[i].char == token2.parameters[i].char && token1.parameters[i].cat == token2.parameters[i].cat) {
                            // If the two are character tokens and their charCodes and catcodes agree, then
                            // move on to the next token.
                            continue;
                        } else if (token1.parameters[i].type == 'command' && token1.parameters[i].name == token2.parameters[i].name) {
                            // If the two are both command tokens and their names agree, then move on to the
                            // next token.
                            continue;
                        } else {
                            // This means that the tokens didn't agree, which means the two macros didn't match
                            // and that the \ifx evaluates to false.
                            return evalIf.call(this, false, e.mouth, e.scopes, ifSym);
                        }
                    }
                    // If all the parameter tokens agree, now the replacement tokens need to be checked
                    // as well in the same way.
                    for (var i = 0, l = token1.replacement.length; i < l; i++) {
                        if (token1.replacement[i].type == 'character' && token1.replacement[i].char == token2.replacement[i].char && token1.replacement[i].cat == token2.replacement[i].cat) continue;
                        else if (token1.replacement[i].type == 'command' && token1.replacement[i].name == token2.replacement[i].name) continue;
                        else return evalIf.call(this, false, e.mouth, e.scopes, ifSym);
                    }
                    // If both the parameters and replacement tokens all agree, then the two must have
                    // the same top level expansion and the \ifx evaluates to true.
                    return evalIf.call(this, true, e.mouth, e.scopes, ifSym);
                }),
                it: new Primitive('it', function(e) {
                    // \it makes all the characters in the rest of the scope italic and unbolded.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    e.tokens.push({
                        type: 'font modifier',
                        value: 'it'
                    });
                    return [];
                }),
                kern: new Primitive('kern', function(e) {
                    // \kern creates spacing between the last atom and the next atom to be parsed. It
                    // only accepts non-mu dimensions and can even be negative to make atoms overlap
                    // each other. \mkern is the mu dimension equivalent of \kern.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var dimen = e.mouth.eat('dimension');
                    if (!dimen) {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }
                    e.tokens.push({
                        type: 'kern',
                        dimen: dimen
                    });
                    return [];
                }),
                lccode: new Primitive('lccode', function(e) {
                    // \lccode takes an integer argument. That integer is converted to a character (via
                    // charCodes) and the lowercase value for that character is gotten. An integer reg-
                    // ister is returned with the charCode of that lowercase character. This can be
                    // used to set lowercase values of characters that ordinarily wouldn't have a lo-
                    // wercase value. For example, \lccode`\C="00A2 will set the lowercase value of C
                    // to the cents character. Next time C is used in a \lowercase, it will be replaced
                    // with the cents character instead of "c".

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var integer = e.mouth.eat('integer');

                    if (integer || integer.value < 0) {
                        return [e.scopes.last.lc[integer.value] = e.scopes.last.lc[integer.value] || new IntegerReg(0)];
                    } else {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }
                }),
                left: new Primitive('left', function(e) {
                    // \left must be followed by a delimiter. It creates a new group (Scope) and ex-
                    // pands the delimiters to the height of the subformula.

                    // First make sure no superscript or subscript context is open.
                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var leftSym = Symbol();
                    e.mouth.saveState(leftSym);

                    while (true) {
                        // Look for a delimiter by expanding any macros found.
                        var token = e.mouth.eat();

                        if (token && (token.type == 'command' || token.type == 'character' && token.cat == data.cats.active)) {
                            var expansion = e.mouth.expand(token, e.mouth);

                            e.mouth.queue.unshift.apply(e.mouth.queue, expansion);
                        } else if (token && token.type == 'character' && data.delims.includes(token.code) && (token.cat == data.cats.all || token.cat == data.cats.letter)) {
                            new e.Scope();
                            e.scopes.last.delimited = true;
                            e.scopes.last.leftDelimiter = token.char;
                            e.scopes.last.nullDelimiterSpace = new DimenReg(e.scopes.last.registers.named.nulldelimiterspace);
                            e.openGroups.push(this);
                            e.contexts.push('scope');
                            e.scopes.last.tokens.push(this);
                            e.scopes.last.tokens.push({
                                type: 'atom',
                                atomType: 0,
                                nucleus: {
                                    type: 'symbol',
                                    char: token.char,
                                    code: token.code
                                },
                                subscript: null,
                                superscript: null
                            });
                            this.ignore = true;
                            break;
                        } else {
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(leftSym);
                            return [this];
                        }
                    }
                }),
                let: new Primitive('let', function(e) {
                    // \let is used to copy macros to new macros. It's different from \def in that the
                    // macro's DEFINITION is copied, not the macro itself. Even if the old macro is
                    // changed, the new macro holds the same macro definition. A lot of the code below
                    // is copied from \def since they're almost the same.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var letSym = Symbol();
                    e.mouth.saveState(letSym);

                    var name = e.mouth.eat();
                    if (!name) {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }
                    var type;
                    if (name.type == 'character') {
                        if (e.catOf(name.char) == data.cats.active) {
                            type = 'active';
                            name = name.char;
                        } else {
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(letSym);
                            return [this];
                        }
                    } else if (name.type == 'command') {
                        type = 'macro';
                        name = name.name;
                        if (name in e.scopes.last.defs.primitive || name in data.parameters) {
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(letSym);
                            return [this];
                        }
                    }

                    var optEquals = e.mouth.eat();
                    if (!optEquals || optEquals.type != 'character' || optEquals.char != '=' || optEquals.cat != data.cats.all) optEquals && e.mouth.revert();

                    var token = e.mouth.eat();

                    if (!token) {
                        this.invalid = true;
                        this.recognized = true;
                        e.mouth.loadState(letSym);
                        return [this];
                    } else if (token.type == 'command' || token.type == 'character' && token.cat == data.cats.active) {
                        var macro = token.type == 'command' ? e.scopes.last.defs.primitive[token.name] || e.scopes.last.defs.macros[token.name] : e.scopes.last.defs.active[token.name];
                        if (macro) macro = new Macro(macro, macro.type == 'primitive' || macro.isLet);
                        else if (token.type == 'command' && type == 'macro') {
                            // Check if the command refers to a register.
                            var reg = e.scopes.last.registers.named[token.name];
                            if (reg) {
                                // If it does, make a new entry in the named registers.
                                if (e.toggles.global && e.scopes.last.registers.named.globaldefs.value >= 0 || e.scopes.last.registers.named.globaldefs.value > 0) {
                                    data.registers.named[name] = reg;
                                    delete data.defs.macros[name];
                                    for (var i = 0, l = e.scopes.length; i < l; i++) {
                                        e.scopes[i].registers.named[name] = reg;
                                        delete e.scopes[i].defs.macros[name];
                                    }
                                } else {
                                    e.scopes.last.registers.named[name] = reg;
                                    delete e.scopes.last.defs.macros[name];
                                }
                                e.toggles.global = false;
                                return [];
                            }
                        }
                    } else {
                        // There are two calls to new Macro so that the macro is recognized as a proxy.
                        var macro = new Macro(new Macro([token]), true);
                    }

                    if (e.toggles.global && e.scopes.last.registers.named.globaldefs.value >= 0 || e.scopes.last.registers.named.globaldefs.value > 0) {
                        if (type == 'macro') {
                            if (macro) data.defs.macros[name] = macro;
                            else delete data.defs.macros[name];
                            delete data.registers.named[name];
                            for (var i = 0, l = e.scopes.length; i < l; i++) {
                                if (macro) e.scopes[i].defs.macros[name] = macro;
                                else delete e.scopes[i].defs.macros[name];
                                delete e.scopes[i].registers.named[name];
                            }
                        } else {
                            if (macro) data.defs.active[name] = macro;
                            else delete data.defs.active[name];
                            delete data.registers.named[name];
                            for (var i = 0, l = e.scopes.length; i < l; i++) {
                                if (macro) e.scopes[i].defs.active[name] = macro;
                                else delete e.scopes[i].defs.active[name];
                                delete e.scopes[i].registers[name];
                            }
                        }
                    } else {
                        if (macro) e.scopes.last.defs[type == 'macro' ? 'macros' : 'active'][name] = macro;
                        else delete e.scopes.last.defs[type == 'macro' ? 'macros' : 'active'][name];
                        delete e.scopes.last.registers.named[name];
                    }

                    e.toggles.global = false;

                    return [];
                }),
                limits: new Primitive('limits', function(e) {
                    // \limits is like \displaylimits in that it controls where superscripts and sub-
                    // scripts are rendered. Instead of depending on the current style though, it will
                    // always render the limits above or below the atom, even if the style isn't dis-
                    // play.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    e.tokens.push({
                        type: 'limit modifier',
                        value: true,
                        token: this
                    });
                    return [];
                }),
                lower: new Primitive('lower', function(e) {
                    // In TeX, normally, \lower will lower the next box by the specified dimension.
                    // In this version, it'll lower the next thing, whether that be an atom, a box,
                    // a table, anything. That's because \hbox and \vbox is just barely implemented
                    // here, so it would kinda suck having to make a box every time. This is basic-
                    // ally a vertical version of \kern except it affects only the next token instead
                    // of everything.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var dimen = e.mouth.eat('dimension');
                    if (!dimen) {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }
                    // Since \lower makes items go down (negative height), the dimension is inverted to
                    // have negated values.
                    dimen.sp.value *= -1;
                    dimen.em.value *= -1;
                    e.tokens.push({
                        type: 'vkern',
                        dimen: dimen
                    });
                    return [];
                }),
                lowercase: new Primitive('lowercase', function(e) {
                    // \lowercase takes one argument (MUST be delimited by opening and closing tokens)
                    // and scans all the tokens inside it. Any character tokens (command tokens are ig-
                    // nored) are converted to their lowercase value according to their \lccode value.
                    // Only the character's character value is changed, not its catcode value. If you
                    // lowercase an "f" into a "1" (you'd have to change its \lccode), then the result-
                    // ing "1" would still have the catcode of "f" (usually 11).

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var lcSym = Symbol();
                    e.mouth.saveState(lcSym);

                    var open = e.mouth.eat('pre space');
                    if (!open || open.cat != data.cats.open) {
                        this.invalid = true;
                        this.recognized = true;
                        e.mouth.loadState(lcSym);
                        return [this];
                    }

                    var tokens = [],
                        groups = 1;
                    while (true) {
                        var token = e.mouth.eat('pre space');

                        if (!token) {
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(lcSym);
                            return [this];
                        } else if (token.type == 'character' && token.cat == data.cats.open) {
                            groups++;
                            tokens.push(token);
                        } else if (token.type == 'character' && token.cat == data.cats.close) {
                            groups--;
                            if (groups > 0) tokens.push(token);
                            else break;
                        } else tokens.push(token);
                    }

                    for (var i = 0, l = tokens.length; i < l; i++) {
                        if (tokens[i].type == 'character' && e.scopes.last.lc[tokens[i].code] && e.scopes.last.lc[tokens[i].code].value > 0) {
                            tokens[i].code = e.scopes.last.lc[tokens[i].code].value;
                            tokens[i].char = String.fromCharCode(tokens[i].code);
                        }
                    }
                    return tokens;
                }),
                mathbin: new Primitive('mathbin', function(e) {
                    // \mathbin (and \mathclose, \mathinner, \mathop, \mathopen, \mathord, \mathpunct,
                    // and \mathrel) create a temporary token that will change the next atom after it.
                    // The next atom will inherit the spacing for a Bin atom, even if it normally
                    // wouldn't. This applies to the other \math[family] commands listed above. Bin
                    // atoms of course might still be replaced with Ord atoms if the context isn't
                    // right for a Bin atom, but that's the only exception where one of these commands
                    // won't work as intended.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    // All \mathbin, \mathclose, ... , \mathrel commands work like \accent. A temporary
                    // token is created and resolved later.
                    e.tokens.push({
                        type: 'family modifier',
                        value: 2,
                        token: this
                    });
                    return [];
                }),
                mathchar: new Primitive('mathchar', function(e) {
                    // \mathchar works the same as \char except the first number is interpreted as the
                    // family number. Since the number is usually passed as hexadecimal, the first num-
                    // ber (read as base 16) is used as the family number. The other digits of the
                    // number are used as the character code.

                    var charCode = e.mouth.eat('integer');
                    if (!charCode || charCode.value < 0) {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    if (charCode.value < 65536) var family = 0;
                    else if (charCode.value < 524288) {
                        var code = charCode.value % 65536;
                        var family = (charCode.value - code) / 65536;
                        charCode.value = code;
                    } else var family = 0;

                    // If the context is a superscript or subscript, the family of the character won't
                    // matter. Spacing doesn't happen around superscript and subscript tokens. If it's
                    // not a superscript/subscript, then the character will be parsed as if it had been
                    // preceded by a \mathbin, \mathclose, \mathinner, etc.
                    if (e.contexts.last != 'superscript' && e.contexts.last != 'subscript') {
                        e.tokens.push({
                            type: 'family modifier',
                            value: family,
                            token: this
                        });
                    }

                    // The token will be parsed and put into a nucleus/superscript/subscript naturally.
                    e.mouth.queue.unshift({
                        type: 'character',
                        cat: data.cats.all,
                        char: String.fromCharCode(charCode.value),
                        code: charCode.value
                    });
                    return [];
                }),
                mathchardef: new Primitive('mathchardef', function(e) {
                    // A combination of \mathchar and \chardef.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var charDefSym = Symbol();
                    e.mouth.saveState(charDefSym);
                    var name = e.mouth.eat();

                    if (name && name.type == 'command') {
                        if (name.name in data.defs.primitive || name.name in data.parameters) {
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(charDefSym);
                            return [true];
                        }
                        var optEquals = e.mouth.eat();
                        if (!optEquals || optEquals.type != 'character' || optEquals.char != '=' || optEquals.cat != data.cats.all) optEquals && e.mouth.revert();
                        var integer = e.mouth.eat('integer');
                        if (!integer || integer.value < 0) {
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(charDefSym);
                            return [true];
                        }

                        if (integer.value < 65536) var family = 0;
                        else if (integer.value < 524288) {
                            var code = integer.value % 65536;
                            var family = (integer.value - code) / 65536;
                            integer.value = code;
                        } else var family = 0;

                        var macro = new Macro([{
                            type: 'command',
                            escapeChar: this.escapeChar,
                            name: 'math' + ['ord', 'op', 'bin', 'rel', 'open', 'close', 'punct', 'inner'][family],
                            nameType: 'command'
                        },{
                            type: 'character',
                            cat: data.cats.all,
                            char: String.fromCharCode(integer.value),
                            code: integer.value
                        }], []);
                        if (e.toggles.global && e.scopes.last.registers.named.globaldefs.value >= 0 || e.scopes.last.registers.named.globaldefs.value > 0) {
                            data.defs.macros[name.name] = macro;
                            delete data.registers.named[name.name];
                            for (var i = 0, l = e.scopes.length; i < l; i++) {
                                e.scopes[i].defs.macros[name.name] = macro;
                                delete e.scopes[i].registers.named[name.name];
                            }
                        } else {
                            e.scopes.last.defs.macros[name.name] = macro;
                            delete e.scopes.last.registers.named[name.name];
                        }
                        e.toggles.global = false;
                    } else {
                        this.invalid = true;
                        this.recognized = true;
                        e.mouth.loadState(charDefSym);
                        return [true];
                    }
                }),
                mathchoice: new Primitive('mathchoice', function(e) {
                    // \mathchoice takes four arguments. Each one is a list of tokens. The first is
                    // used if \displaystyle is being used. The second for \textstyle, the third for
                    // \scriptstyle, and the fourth for \scriptscriptstyle. Since we won't know the
                    // real style until the TeX is actually rendered, we can't just take four arguments
                    // ans spit one out like a regular macro. Instead, a special token has to be made
                    // that will survive until it's rendered. Once it gets there, one of the four argu-
                    // ments will be chosen and rendered. We can't just take four arguments and store
                    // them as regular symbols though; they have to be parsed like normal tokens. To
                    // do that, a new special context is made called "mathchoice". It'll actually be
                    // a JSON object so that it can store data, but still be able to evaluate to
                    // "mathchoice" so it can be compared like a regular string. Since the four argu-
                    // ments must be surrounded in opening and closing tokens and be right next to each
                    // other (only non-atom characters like whitespace and comments can be between
                    // them), no tokens are allowed between the groups. That means if any token is
                    // being parsed with the last context == "mathchoice", the \mathchoice fails alto-
                    // gether. Token withing groups will have a last context of "scope".

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var token = this;
                    e.contexts.push({
                        toString: function() {return 'mathchoice'},
                        token: token,
                        current: 0,
                        failed: function() {
                            // This function will get called if a token is found in the wrong place and the
                            // \mathchoice failed.

                            this.token.invalid = true;
                            e.contexts.pop();
                        },
                        succeeded: function() {
                            // This will get called if all four groups were found successfully and the context
                            // needs to be closed.
                            e.contexts.pop();
                            this.token.type = 'mathchoice';
                            // The four grouped tokens that were made need to be removed from the token list so
                            // that they don't all get rendered.
                            this.token.groups = e.scopes.last.tokens.splice(e.scopes.last.tokens.length - 4, 4);
                            this.token.ignore = false;
                        }
                    });
                    e.tokens.push(this);
                    this.ignore = true;
                }),
                mathclose: new Primitive('mathclose', function(e) {
                    // Look at the description of \mathbin.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    e.tokens.push({
                        type: 'family modifier',
                        value: 5,
                        token: this
                    });
                    return [];
                }),
                mathinner: new Primitive('mathinner', function(e) {
                    // Look at the description of \mathbin.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    e.tokens.push({
                        type: 'family modifier',
                        value: 'inner', // Family 7 is reserved for variables. The literal string "inner" is used here instead.
                        token: this
                    });
                    return [];
                }),
                mathop: new Primitive('mathop', function(e) {
                    // Look at the description of \mathbin.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    e.tokens.push({
                        type: 'family modifier',
                        value: 1,
                        token: this
                    });
                    return [];
                }),
                mathopen: new Primitive('mathopen', function(e) {
                    // Look at the description of \mathbin.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    e.tokens.push({
                        type: 'family modifier',
                        value: 4,
                        token: this
                    });
                    return [];
                }),
                mathord: new Primitive('mathord', function(e) {
                    // Look at the description of \mathbin.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    e.tokens.push({
                        type: 'family modifier',
                        value: 0,
                        token: this
                    });
                    return [];
                }),
                mathpunct: new Primitive('mathpunct', function(e) {
                    // Look at the description of \mathpunct.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    e.tokens.push({
                        type: 'family modifier',
                        value: 6,
                        token: this
                    });
                    return [];
                }),
                mathrel: new Primitive('mathrel', function(e) {
                    // Look at the description of \mathrel.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    e.tokens.push({
                        type: 'family modifier',
                        value: 3,
                        token: this
                    });
                    return [];
                }),
                message: new Primitive('message', function(e) {
                    // \message writes text directly to the console. The argument immediately after it
                    // must be delimited by opening and closing tokens.

                    var errSym = Symbol();
                    e.mouth.saveState(errSym);

                    var token = e.mouth.eat();
                    if (!token || token.type != 'character' || token.cat != data.cats.open) {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    } else {
                        var openGroups = 0,
                            tokens = [];
                        while (true) {
                            var token = e.mouth.eat('pre space');

                            if (!token) {
                                this.invalid = true;
                                this.recognized = true;
                                e.mouth.loadState(errSym);
                                return [this];
                            } else if (token.type == 'character' && token.cat == data.cats.open) {
                                openGroups++;
                                tokens.push(token.char);
                            } else if (token.type == 'character' && token.cat == data.cats.close) {
                                if (!openGroups) break;
                                openGroups--;
                                tokens.push(token.char);
                            } else if (token.type == 'command') {
                                tokens.push(token.escapeChar);
                                tokens.push.apply(tokens, token.name.split(''));
                            } else {
                                tokens.push(token.char);
                            }
                        }
                        _msg(tokens.join(''));
                    }
                }),
                mkern: new Primitive('mkern', function(e) {
                    // Mu dimension version of \kern.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var dimen = e.mouth.eat('mu dimension');
                    if (!dimen) {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }
                    e.tokens.push({
                        type: 'kern',
                        dimen: dimen
                    });
                    return [];
                }),
                month: new Primitive('month', function(e) {
                    // Returns the current month in the range [1,12].

                    return [new IntegerReg(new Date().getMonth() + 1)];
                }),
                mskip: new Primitive('mskip', function(e) {
                    // Mu glue version of \hskip.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var glue = e.mouth.eat('mu glue');
                    if (!glue) {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }
                    e.tokens.push({
                        type: 'glue',
                        glue: glue
                    });
                    return [];
                }),
                multiply: new Primitive('multiply', function(e) {
                    // \multiply multiplies a register by a specified value.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var multiplySym = Symbol();
                    e.mouth.saveState(multiplySym);

                    while (true) {
                        var register = e.mouth.eat();

                        if (register && (register.type == 'command' || register.type == 'character' && register.cat == data.cats.active)) {
                            var expansion = e.mouth.expand(register, e.mouth);

                            e.mouth.queue.unshift.apply(e.mouth.queue, expansion);
                        } else if (register && register.register) {
                            if (register && register.register) {
                                var token = e.mouth.eat();

                                if (token && token.type == 'character' && (token.char == 'b' || token.char == 'B') && token.cat != data.cats.active) {
                                    var y = e.mouth.eat();
                                    if (!(y && y.type == 'character' && (y.char == 'y' || y.char == 'Y') && y.cat != data.cats.active)) e.mouth.revert(2);
                                } else if (token) e.mouth.revert();
                                else {
                                    this.invalid = true;
                                    this.recognized = true;
                                    e.mouth.loadState(multiplySym);
                                    return [this];
                                }

                                var multiplier = e.mouth.eat('integer');

                                if (multiplier) {
                                    if (register.type == 'integer') {
                                        register.value *= multiplier.value;
                                        var reg = register;
                                        if (e.toggles.global && e.scopes.last.registers.named.globaldefs.value >= 0 || e.scopes.last.registers.named.globaldefs.value > 0) {
                                            while (register.parent) {
                                                register = register.parent;
                                                register.value = reg.value;
                                            }
                                        }
                                        e.toggles.global = false;
                                    } else if (register.type == 'dimension') {
                                        register.sp.value *= multiplier.value;
                                        register.em.value *= multiplier.value;
                                        var reg = register;
                                        if (e.toggles.global && e.scopes.last.registers.named.globaldefs.value >= 0 || e.scopes.last.registers.named.globaldefs.value > 0) {
                                            while (register.parent) {
                                                register = register.parent;
                                                register.sp.value = reg.sp.value;
                                                register.em.value = reg.em.value;
                                            }
                                        }
                                        e.toggles.global = false;
                                    } else if (register.type == 'mu dimension') {
                                        register.mu.value *= multiplier.value;
                                        var reg = register;
                                        if (e.toggles.global && e.scopes.last.registers.named.globaldefs.value >= 0 || e.scopes.last.registers.named.globaldefs.value > 0) {
                                            while (register.parent) {
                                                register = register.parent;
                                                register.mu.value = reg.mu.value;
                                            }
                                        }
                                        e.toggles.global = false;
                                    } else if (register.type == 'glue') {
                                        register.start.sp.value *= multiplier.value;
                                        register.start.em.value *= multiplier.value;
                                        if (register.stretch.type == 'infinite dimension') register.stretch.number.value *= multiplier.value;
                                        else {
                                            register.stretch.sp.value *= multiplier.value;
                                            register.stretch.em.value *= multiplier.value;
                                        }
                                        if (register.shrink.type == 'infinite dimension') register.shrink.number.value *= multiplier.value;
                                        else {
                                            register.shrink.sp.value *= multiplier.value;
                                            register.shrink.em.value *= multiplier.value;
                                        }
                                        var reg = register;
                                        if (e.toggles.global && e.scopes.last.registers.named.globaldefs.value >= 0 || e.scopes.last.registers.named.globaldefs.value > 0) {
                                            while (register.parent) {
                                                register = register.parent;
                                                register.start.sp.value = reg.start.sp.value;
                                                register.start.em.value = reg.start.em.value;
                                                if (reg.stretch.type == 'infinite dimension') register.stretch = new InfDimen(reg.stretch.number.value, reg.stretch.magnitude.value);
                                                else register.stretch = new DimenReg(reg.stretch.sp.value, reg.stretch.em.value);
                                                if (reg.shrink.type == 'infinite dimension') register.shrink = new InfDimen(reg.shrink.number.value, reg.shrink.magnitude.value);
                                                else register.shrink = new DimenReg(reg.shrink.sp.value, reg.shrink.em.value);
                                            }
                                        }
                                        e.toggles.global = false;
                                    } else if (register.type == 'mu glue') {
                                        register.start.mu.value *= multiplier.value;
                                        if (register.stretch.type == 'infinite dimension') register.stretch.number.value *= multiplier.value;
                                        else register.stretch.mu.value *= multiplier.value;
                                        if (register.shrink.type == 'infinite dimension') register.shrink.number.value *= multiplier.value;
                                        else register.shrink.mu.value *= multiplier.value;
                                        var reg = register;
                                        if (e.toggles.global && e.scopes.last.registers.named.globaldefs.value >= 0 || e.scopes.last.registers.named.globaldefs.value > 0) {
                                            while (register.parent) {
                                                register = register.parent;
                                                register.start.mu.value = reg.start.mu.value;
                                                if (reg.stretch.type == 'infinite dimension') register.stretch = new InfDimen(reg.stretch.number.value, reg.stretch.magnitude.value);
                                                else register.stretch = new MuDimenReg(reg.stretch.mu.value);
                                                if (reg.shrink.type == 'infinite dimension') register.shrink = new InfDimen(reg.shrink.number.value, reg.shrink.magnitude.value);
                                                else register.shrink = new MuDimenReg(reg.shrink.mu.value);
                                            }
                                        }
                                        e.toggles.global = false;
                                    }
                                } else {
                                    this.invalid = true;
                                    this.recognized = true;
                                    e.mouth.loadState(multiplySym);
                                    return [this];
                                }
                                break;
                            } else {
                                this.invalid = true;
                                this.recognized = true;
                                e.mouth.loadState(multiplySym);
                                return [this]
                            }
                        } else {
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(multiplySym);
                            return [this];
                        }
                    }
                    return [];
                }),
                muskip: new Primitive('muskip', function(e) {
                    // Returns the mu glue register at the specified index.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var muglue = e.mouth.eat('integer');
                    if (!muglue || muglue.value < 0) {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }
                    if (!data.registers.muskip[muglue.value]) {
                        data.registers.muskip[muglue.value] = new MuGlueReg(new MuDimenReg(0, 0), new MuDimenReg(0, 0), new MuDimenReg(0, 0));
                        for (var i = 0, l = e.scopes.length; i < l; i++) {
                            e.scopes[i].registers.muskip[muglue.value] = new MuGlueReg((i ? e.scopes[i - 1] : data).registers.muskip[muglue.value]);
                        }
                    }
                    return [e.scopes.last.registers.muskip[muglue.value]];
                }),
                muskipdef: new Primitive('muskipdef', function(e) {
                    // Mu glue version of \countdef.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var skipDefSym = Symbol();
                    e.mouth.saveState(skipDefSym);
                    var name = e.mouth.eat();

                    if (name.type == 'command') {
                        if (name.name in data.defs.primitive || name.name in data.parameters) {
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(skipDefSym);
                            return [true];
                        }
                        var optEquals = e.mouth.eat();
                        if (!optEquals || optEquals.type != 'character' || optEquals.char != '=' || optEquals.cat != data.cats.all) optEquals && e.mouth.revert();
                        var integer = e.mouth.eat('integer');
                        if (!integer || integer.value < 0) {
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(skipDefSym);
                            return [true];
                        }
                        name = name.name;
                        integer = integer.value;
                        if (!data.registers.muskip[integer]) {
                            data.registers.muskip[integer] = new MuGlueReg(new MuDimenReg(0), new MuDimenReg(0), new MuDimenReg(0));
                            for (var i = 0, l = e.scopes.length; i < l; i++) {
                                e.scopes[i].registers.muskip[integer] = new MuGlueReg((i ? e.scopes[i - 1] : data).registers.muskip[integer]);
                            }
                        }
                        if (e.toggles.global && e.scopes.last.registers.named.globaldefs.value >= 0 || e.scopes.last.registers.named.globaldefs.value > 0) {
                            data.registers.named[name] = data.registers.muskip[integer];
                            delete data.defs.macros[name];
                            for (var i = 0, l = e.scopes.length; i < l; i++) {
                                e.scopes[i].registers.named[name] = e.scopes[i].registers.muskip[integer];
                                delete e.scopes[i].defs.macros[name];
                            }
                        } else {
                            e.scopes.last.registers.named[name] = e.scopes.last.registers.muskip[integer];
                            delete e.scopes.last.defs.macros[name];
                        }
                    } else {
                        this.invalid = true;
                        this.recognized = true;
                        e.mouth.loadState(countDefSym);
                        return [true];
                    }
                }),
                noexpand: new Primitive('noexpand', function(e) {
                    // \noexpand has no use outside of a \edef or \xdef. It is only used to signal that
                    // the next token should not be expanded. Outside of a \edef, a command HAS to be
                    // expanded. Since \edef and \xdef handle \noexpand themselves without calling it,
                    // this function will only be called outside of a definition. If a command follows
                    // noexpand, the \noexpand will be marked as invalid. If a regular character fol-
                    // lows it, then nothing happens; the \noexpand will be ignored and the non-command
                    // token will carry on (since it's not being expanded, just read).

                    var token = e.mouth.eat();
                    if (!token) {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }
                    e.mouth.revert();
                    if (token.type == 'command' || token.type == 'character' && token.cat == data.cats.active) {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }
                    return [];
                }),
                nolimits: new Primitive('nolimits', function(e) {
                    // The opposite of \limits.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    e.tokens.push({
                        type: 'limit modifier',
                        value: false,
                        token: this
                    });
                    return [];
                }),
                nonscript: new Primitive('nonscript', function(e) {
                    // \nonscript basically has the effect of canceling out the next kern or glue item.
                    // If it's followed by a kern or glue, and the style is in script or scriptscript
                    // (caused by \scriptstyle, scriptscriptstyle, or being inside a superscript or
                    // subscript), then the kern/glue that follows is removed from the token list. If
                    // there is no kern or glue after it, it's not marked as invalid; nothing happens
                    // in that case.

                    // Mu glue version of \hskip.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    e.tokens.push({
                        type: 'glue',
                        isNonScript: true
                    });
                    return [];
                }),
                normalfont: new Primitive('normalfont', function(e) {
                    // \normalfont makes all the characters in the rest of the scope back to the normal
                    // math font (upright characters except for those in the variable math family).

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    e.tokens.push({
                        type: 'font modifier',
                        value: 'nm'
                    });
                    return [];
                }),
                number: new Primitive('number', function(e) {
                    // \number is basically a specialized version of \the. It returns a list of tokens,
                    // but only for numbers (\the works for any type of register).

                    var integer = e.mouth.eat('integer');
                    if (!integer) {
                        this.invaldi = true;
                        return [this];
                    }

                    return integer.value.toString().split('').map(function(element) {
                        return {
                            type: 'character',
                            cat: data.cats.all,
                            char: element,
                            code: element.charCodeAt(0)
                        };
                    });
                }),
                omit: new Primitive('omit', function(e) {
                    // \omit is used in \halign and is handled elsewhere (after a \cr or alignment to-
                    // ken).

                    this.invalid = true;
                    this.recognized = true;
                    return [this];
                }),
                or: new Primitive('or', function(e) {
                    // \or is only allowed inside \ifcase blocks. \or is handled in there, so this
                    // function is only called when in an invalid context.

                    this.invalid = true;
                    this.recognized = true;
                    return [this];
                }),
                over: new Primitive('over', function(e) {
                    // Works the same as \above except the fraction bar's width is generated from the
                    // font's | character's visible width. It guesses the fraction bar so that it will
                    // change with the font to look as natural as possible. A thick-looking font should
                    // have a thick-looking bar.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    // Mark the last scope as a fraction.
                    e.scopes.last.isFrac = true;

                    // Every fraction has delimiters that act like \left and \right delimiters. In the
                    // case of \above, it has empty delimiters, which are just period tokens. You can
                    // use \abovewithdelims to change the delimiters.
                    e.scopes.last.fracLeftDelim = e.scopes.last.fracRightDelim = '.';

                    e.scopes.last.barWidth = 'from font';

                    e.scopes.last.fracNumerator = e.scopes.last.tokens;
                    e.scopes.last.tokens = [];

                    return [];
                }),
                overline: new Primitive('overline', function(e) {
                    // \overline adds a bar over the next atom. It's similar to \mathbin and its re-
                    // lated commands, except \overline renders the atom as Ord. The bar's width is de-
                    // termined from the "|" character's visible width.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    e.tokens.push({
                        type: 'family modifier',
                        value: 'over',
                        token: this
                    });
                    return [];
                }),
                overwithdelims: new Primitive('overwithdelims', function(e) {
                    // Combination of \over and \abovewithdelims.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var overDelimsSym = Symbol();
                    e.mouth.saveState(overDelimsSym);

                    while (true) {
                        var token = e.mouth.eat();

                        if (token && (token.type == 'command' || token.type == 'character' && token.cat == data.cats.active)) {
                            var expansion = e.mouth.expand(token, e.mouth);

                            e.mouth.queue.unshift.apply(e.mouth.queue, expansion);
                        } else if (token && token.type == 'character' && data.delims.includes(token.code) && (token.cat == data.cats.all || token.cat == data.cats.letter)) {
                            if (e.scopes.last.fracLeftDelim) {
                                e.scopes.last.fracRightDelim = token.char;
                                break;
                            } else {
                                e.scopes.last.fracLeftDelim = token.char;
                            }
                        } else {
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(overDelimsSym);
                            delete e.scopes.last.fracLeftDelim;
                            return [this];
                        }
                    }

                    e.scopes.last.isFrac = true;

                    e.scopes.last.barWidth = 'from font';

                    e.scopes.last.fracNumerator = e.scopes.last.tokens;
                    e.scopes.last.tokens = [];

                    return [];
                }),
                raise: new Primitive('raise', function(e) {
                    // \raise is the exact opposite of \lower. It'll raise the next token by a specif-
                    // ied dimension.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var dimen = e.mouth.eat('dimension');
                    if (!dimen) {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }
                    e.tokens.push({
                        type: 'vkern',
                        dimen: dimen
                    });
                    return [];
                }),
                relax: new Primitive('relax', function(e) {
                    // \relax literally does nothing. It's only real use is to end token scanning early
                    // when searching for a glue object or other type of register. For example, if a
                    // macro is made with \def\cmd{\skip0=1pt}, then you would expect it to set the 0th
                    // skip register to a glue with a start of 1pt and a stretch and shrink of 0pt. But
                    // if you called it as "\cmd plus 1pt", then \cmd would be expanded and the text
                    // would read "\skip0=1pt plus 1pt". Notice that the " plus 1pt" is now being
                    // parsed as part of the glue, even though it wasn't originally meant to. If you
                    // change the macro however to \def\cmd{\skip0=1pt\relax}, then it would expand out
                    // to "\skip0=1pt\relax plus 1pt". Notice that the \relax breaks up the "1pt" and
                    // the " plus 1pt" so that the glue will be set correctly and the " plus 1pt" will
                    // be parsed as their own independent tokens. Other than that, \relax expands to
                    // nothing and is literally skipped over like it didn't exist.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    return [];
                }),
                right: new Primitive('right', function(e) {
                    // \right is the closer for \left. It also must be followed by a delimiter.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    // First, check if the last group actually exists and was opened by a \left.
                    if (!e.openGroups.length || !e.scopes.last.delimited || e.scopes.last.isHalign || e.scopes.last.isHalignCell || e.scopes.last.semisimple) {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var rightSym = Symbol();
                    e.mouth.saveState(rightSym);

                    while (true) {
                        var token = e.mouth.eat();

                        if (token && (token.type == 'command' || token.type == 'character' && token.cat == data.cats.active)) {
                            var expansion = e.mouth.expand(token, e.mouth);

                            e.mouth.queue.unshift.apply(e.mouth.queue, expansion);
                        } else if (token && token.type == 'character' && data.delims.includes(token.code) && (token.cat == data.cats.all || token.cat == data.cats.letter)) {
                            if (e.contexts.last != 'scope') {
                                this.invalid = true;
                                this.recognized = true;
                                e.mouth.loadState(rightSym);
                                return [this];
                            }
                            e.openGroups.pop();
                            e.contexts.pop();
                            var tokens = e.scopes.last.tokens;

                            if (e.scopes.last.isFrac) {
                                // These two shifts get rid of the "\left" token and the left delimiter token.
                                e.scopes.last.fracNumerator.shift();
                                e.scopes.last.fracNumerator.shift();
                                e.scopes[e.scopes.length - 2].tokens.push({
                                    type: 'atom',
                                    atomType: 'inner',
                                    nucleus: [{
                                        type: 'fraction',
                                        numerator: e.scopes.last.fracNumerator,
                                        denominator: tokens,
                                        barWidth: e.scopes.last.barWidth,
                                        delims: [e.scopes.last.fracLeftDelim, e.scopes.last.fracRightDelim],
                                        nullDelimiterSpace: new DimenReg(e.scopes.last.registers.named.nulldelimiterspace)
                                    }],
                                    superscript: null,
                                    subscript: null,
                                    delimited: true,
                                    nullDelimiterSpace: new DimenReg(e.scopes.last.registers.named.nulldelimiterspace),
                                    delims: [e.scopes.last.leftDelimiter, token.char]
                                });
                                e.scopes.pop();
                            } else {
                                tokens.shift();
                                tokens.shift();
                                var leftDelim = e.scopes.last.leftDelimiter;
                                e.scopes.pop();
                                e.scopes.last.tokens.push({
                                    type: 'atom',
                                    atomType: 'inner',
                                    nucleus: tokens,
                                    superscript: null,
                                    subscript: null,
                                    delimited: true,
                                    nullDelimiterSpace: new DimenReg(e.scopes.last.registers.named.nulldelimiterspace),
                                    delims: [leftDelim, token.char]
                                });
                            }
                            break;
                        } else {
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(rightSym);
                            return [this];
                        }
                    }
                }),
                rm: new Primitive('rm', function(e) {
                    // \rm makes all the characters in the rest of the scope upright and unbolded.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    e.tokens.push({
                        type: 'font modifier',
                        value: 'rm'
                    });
                    return [];
                }),
                romannumeral: new Primitive('romannumeral', function(e) {
                    // \romannumeral is like \number, except the tokens returned are in the form of ro-
                    // man numerals (M, D, C, L, X, V, or I). Roman numerals only go up to 1000. After
                    // that, they are supposed to be overlined to indicate x1000. TeX though, even
                    // though overline atoms exist, doesn't do that. Instead, it returns an extra "m"
                    // for every 1000 that goes over. That same behavior is mirrored here. Negative
                    // numbers and 0 are not allowed and will return invalid. All tokens are returned
                    // lowercase and can be made capital via \uppercase.

                    var integer = e.mouth.eat('integer');
                    if (!integer) {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }
                    if (integer.value <= 0) {
                        this.invalid = true;
                        this.recognized = true;
                        e.mouth.revert();
                        return [this];
                    }

                    var chars = '';
                    integer = integer.value;
                    var M = ~~(integer / 1000);
                    integer %= 1000;
                    var C = ~~(integer / 100);
                    integer %= 100;
                    var X = ~~(integer / 10);
                    var I = integer % 10;

                    chars = new Array(M + 1).join('m');
                    if (C < 3) chars += new Array(C + 1).join('c');
                    else if (C == 4) chars += 'cd';
                    else if (C < 9) chars += 'd' + new Array(C % 5 + 1).join('c');
                    else chars += 'cm';
                    if (X < 3) chars += new Array(X + 1).join('x');
                    else if (X == 4) chars += 'xl';
                    else if (X < 9) chars += 'l' + new Array(X % 5 + 1).join('x');
                    else chars += 'xc';
                    if (I < 3) chars += new Array(I + 1).join('i');
                    else if (I == 4) chars += 'iv';
                    else if (I < 9) chars += 'v' + new Array(I % 5 + 1).join('i');
                    else chars += 'ix';

                    return chars.split('').map(function(element) {
                        return {
                            type: 'character',
                            cat: data.cats.all,
                            char: element,
                            code: element.charCodeAt(0)
                        };
                    });
                }),
                scriptscriptstyle: new Primitive('scriptscriptstyle', function(e) {
                    // \scriptscriptstyle makes all the characters in the rest of the scope appear like
                    // the superscript/subscript of a superscript/subscript.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    e.tokens.push({
                        type: 'font modifier',
                        value: 'scriptscriptstyle'
                    });
                    return [];
                }),
                scriptstyle: new Primitive('scriptstyle', function(e) {
                    // \scriptstyle makes all the characters in the rest of the scope appear as it's
                    // the superscript or subscript of an inline equation.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    e.tokens.push({
                        type: 'font modifier',
                        value: 'scriptstyle'
                    });
                    return [];
                }),
                show: new Primitive('show', function(e) {
                    // \show is a special type of primitive because it would normally send text to the
                    // terminal in TeX. In this version, the closest JavaScript has to a terminal is
                    // the browser's console. \show will eat the next token and show it in the console.
                    // If it's a character token, the character will be shown along with its catcode
                    // (e.g. \show a => "the letter a", \show# => "macro parameter character #"). If
                    // the token is a command, its top level expansion will be shown instead. Primitive
                    // commands expand to themselves though so that's all it'll show. If the command
                    // name is undefined, the literal text "undefined" will be shown. Active characters
                    // like ~ are shown as their expansion, not their catcode. This primitive will only
                    // send text to the console and expands to nothing.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var preString = e.mouth.string,
                        token = e.mouth.eat();
                    if (!token) {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }
                    var string = '"' + this.escapeChar + this.name + preString.substring(0, preString.length - e.mouth.string.length) + '":\n';
                    if (token.type == 'command' || token.type == 'character' && token.cat == data.cats.active) {
                        var macro = token.type == 'command' ? e.scopes.last.defs.primitive[token.name] || e.scopes.last.defs.macros[token.name] : e.scopes.last.defs.active[token.char];

                        if (!macro) {
                            _msg(string + token.escapeChar + token.name + '=undefined.');
                            return [];
                        } else if (macro.type == 'primitive' || macro.isLet && macro.original.type == 'primitive') {
                            _msg(string + token.escapeChar + token.name + '=' + String.fromCharCode(e.scopes.last.registers.named.escapechar.value) + (macro.original || macro).name);
                            return [];
                        } else if (macro.isLet) {
                            string += token.escapeChar + token.name + '=';
                            token = macro.original.replacement[0];
                        } else {
                            string += token.escapeChar + token.name + '=macro:\n';
                            var paramNum = 0;
                            for (var i = 0, l = macro.parameters.length; i < l; i++) {
                                if (macro.parameters[i].type == 'character' && macro.parameters[i].cat != data.cats.param) string += macro.parameters[i].char;
                                else if (macro.parameters[i].type == 'character') string += macro.parameters[i].char + ++paramNum;
                                else string += macro.parameters[i].escapeChar + macro.parameters[i].name;
                            }
                            string += '->';
                            for (var i = 0, l = macro.replacement.length; i < l; i++) {
                                if (macro.replacement[i].type == 'character') string += macro.replacement[i].char;
                                else string += macro.replacement[i].escapeChar + macro.replacement[i].name;
                            }
                            _msg(string);
                            return [];
                        }
                    }
                    // This isn't enclosed in an if block because if a \let command was passed that e-
                    // valuates to a character (e.g. \bgroup), even though it's a command token, it
                    // should be `\show'n as a character token.
                    switch (token.cat) {
                        case data.cats.open:
                            _msg(string + 'begin-group character ' + token.char + '.');
                            break;
                        case data.cats.close:
                            _msg(string + 'end-group character ' + token.char + '.');
                            break;
                        case data.cats.math:
                            _msg(string + 'math shift character ' + token.char + '.');
                            break;
                        case data.cats.alignment:
                            _msg(string + 'alignment tab character ' + token.char + '.');
                            break;
                        case data.cats.param:
                            _msg(string + 'macro parameter character ' + token.char + '.');
                            break;
                        case data.cats.super:
                            _msg(string + 'superscript character ' + token.char + '.');
                            break;
                        case data.cats.sub:
                            _msg(string + 'subscript character ' + token.char + '.');
                            break;
                        case data.cats.whitespace:
                            _msg(string + 'blank space ' + token.char + '.');
                            break;
                        case data.cats.letter:
                            _msg(string + 'the letter ' + token.char + '.');
                            break;
                        case data.cats.all:
                        default:
                            _msg(string + 'the character ' + token.char + '.');
                            break;
                    }
                    return [];
                }),
                showthe: new Primitive('showthe', function(e) {
                    // This command is like \show except that it shows the value of registers. If you
                    // do \show\count0, the result will be showing "\count=\count" instead of showing
                    // the value at the 0th register. \showthe\count0 however will evaluate the \count
                    // and show the value at the 0th count register. The code below is copied from \the
                    // so look there for comments.

                    var theSym = Symbol()
                    e.mouth.saveState(theSym);
                    while (true) {
                        var token = e.mouth.eat();
                        if (token && (token.type == 'command' || token.type == 'character' && token.cat == data.cats.active)) {
                            var expansion = e.mouth.expand(token, e.mouth);
                            e.mouth.queue.unshift.apply(e.mouth.queue, expansion);
                        } else if (token && token.register) {
                            if (token.type == 'integer') {
                                _msg(token.value + '.');
                            } else if (token.type == 'dimension') {
                                var pts = Math.round(token.sp.value / 65536 * 100000) / 100000;
                                pts += (Math.round(token.em.value / 65536 * 100000) / 100000) * 12;
                                _msg(pts + (Number.isInteger(pts) ? '.0pt.' : 'pt.'))
                            } else if (token.type == 'mu dimension') {
                                var mus = Math.round(token.mu.value / 65536 * 100000) / 100000;
                                _msg(mus + (Number.isInteger(mus) ? '.0mu.' : 'mu.'))
                            } else if (token.type == 'glue') {
                                var string = '',
                                    pts = Math.round(token.start.sp.value / 65536 * 100000) / 100000;
                                    pts += (Math.round(token.start.em.value / 65536 * 100000) / 100000) * 12;
                                string = pts + (Number.isInteger(pts) ? '.0pt' : 'pt');
                                if (token.stretch instanceof DimenReg && (token.stretch.sp.value || token.stretch.em.value)) {
                                    pts = Math.round(token.stretch.sp.value / 65536 * 100000) / 100000;
                                    pts += (Math.round(token.stretch.em.value / 65536 * 100000) / 100000) * 12;
                                    string += ' plus ' + pts + (Number.isInteger(pts) ? '.0pt' : 'pt');
                                } else if (token.stretch instanceof InfDimen && token.stretch.number.value) {
                                    var fils = Math.round(token.stretch.number.value / 65536 * 100000) / 100000;
                                    string += ' plus ' + fils + (Number.isInteger(fils) ? '.0' : '') + 'fil' + new Array(token.stretch.magnitude.value).join('l');
                                }
                                if (token.shrink instanceof DimenReg && (token.shrink.sp.value || token.shrink.em.value)) {
                                    pts = Math.round(token.shrink.sp.value / 65536 * 100000) / 100000;
                                    pts += (Math.round(token.shrink.em.value / 65536 * 100000) / 100000) * 12;
                                    string += ' minus ' + pts + (Number.isInteger(pts) ? '.0pt' : 'pt');
                                } else if (token.shrink instanceof InfDimen && token.shrink.number.value) {
                                    var fils = Math.round(token.shrink.number.value / 65536 * 100000) / 100000;
                                    string += ' minus ' + fils + (Number.isInteger(fils) ? '.0' : '') + 'fil' + new Array(token.shrink.magnitude.value).join('l');
                                }
                                _msg(string + '.');
                            } else if (token.type == 'mu glue') {
                                var string = '',
                                    mus = Math.round(token.start.mu.value / 65536 * 100000) / 100000;
                                string = mus + (Number.isInteger(mus) ? '.0mu' : 'mu');
                                if (token.stretch instanceof MuDimenReg && token.stretch.mu.value) {
                                    mus = Math.round(token.stretch.mu.value / 65536 * 100000) / 100000;
                                    string += ' plus ' + mus + (Number.isInteger(mus) ? '.0mu' : 'mu');
                                } else if (token.stretch instanceof InfDimen && token.stretch.number.value) {
                                    var fils = Math.round(token.stretch.number.value / 65536 * 100000) / 100000;
                                    string += ' plus ' + fils + (Number.isInteger(fils) ? '.0' : '') + 'fil' + new Array(token.stretch.magnitude.value).join('l');
                                }
                                if (token.shrink instanceof MuDimenReg && token.shrink.mu.value) {
                                    mus = Math.round(token.shrink.mu.value / 65536 * 100000) / 100000;
                                    string += ' minus ' + mus + (Number.isInteger(mus) ? '.0mu' : 'mu');
                                } else if (token.shrink instanceof InfDimen && token.shrink.number.value) {
                                    var fils = Math.round(token.shrink.number.value / 65536 * 100000) / 100000;
                                    string += ' minus ' + fils + (Number.isInteger(fils) ? '.0' : '') + 'fil' + new Array(token.shrink.magnitude.value).join('l');
                                }
                                _msg(string + '.');
                            }
                            return [];
                        } else {
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(theSym);
                            return [this];
                        }
                    }
                }),
                skip: new Primitive('skip', function(e) {
                    // Returns the glue register at the specified index.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var glue = e.mouth.eat('integer');
                    if (!glue || glue.value < 0) {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }
                    if (!data.registers.skip[glue.value]) {
                        data.registers.skip[glue.value] = new GlueReg(new DimenReg(0, 0), new DimenReg(0, 0), new DimenReg(0, 0));
                        for (var i = 0, l = e.scopes.length; i < l; i++) {
                            e.scopes[i].registers.skip[glue.value] = new GlueReg((i ? e.scopes[i - 1] : data).registers.skip[glue.value]);
                        }
                    }
                    return [e.scopes.last.registers.skip[glue.value]];
                }),
                skipdef: new Primitive('skipdef', function(e) {
                    // Glue version of \countdef.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var skipDefSym = Symbol();
                    e.mouth.saveState(skipDefSym);
                    var name = e.mouth.eat();

                    if (name.type == 'command') {
                        if (name.name in data.defs.primitive || name.name in data.parameters) {
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(skipDefSym);
                            return [true];
                        }
                        var optEquals = e.mouth.eat();
                        if (!optEquals || optEquals.type != 'character' || optEquals.char != '=' || optEquals.cat != data.cats.all) optEquals && e.mouth.revert();
                        var integer = e.mouth.eat('integer');
                        if (!integer || integer.value < 0) {
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(skipDefSym);
                            return [true];
                        }
                        name = name.name;
                        integer = integer.value;
                        if (!data.registers.skip[integer]) {
                            data.registers.skip[integer] = new GlueReg(new DimenReg(0, 0), new DimenReg(0, 0), new DimenReg(0, 0));
                            for (var i = 0, l = e.scopes.length; i < l; i++) {
                                e.scopes[i].registers.skip[integer] = new GlueReg((i ? e.scopes[i - 1] : data).registers.skip[integer]);
                            }
                        }
                        if (e.toggles.global && e.scopes.last.registers.named.globaldefs.value >= 0 || e.scopes.last.registers.named.globaldefs.value > 0) {
                            data.registers.named[name] = data.registers.skip[integer];
                            delete data.defs.macros[name];
                            for (var i = 0, l = e.scopes.length; i < l; i++) {
                                e.scopes[i].registers.named[name] = e.scopes[i].registers.skip[integer];
                                delete e.scopes[i].defs.macros[name];
                            }
                        } else {
                            e.scopes.last.registers.named[name] = e.scopes.last.registers.skip[integer];
                            delete e.scopes.last.defs.macros[name];
                        }
                    } else {
                        this.invalid = true;
                        this.recognized = true;
                        e.mouth.loadState(countDefSym);
                        return [true];
                    }
                }),
                sl: new Primitive('sl', function(e) {
                    // \sl makes all the characters in the rest of the scope oblique and unbolded.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    e.tokens.push({
                        type: 'font modifier',
                        value: 'sl'
                    });
                    return [];
                }),
                span: new Primitive('span', function(e) {
                    // \span is used in \halign. If it's found in the preamble, it'll be handled in the
                    // \halign function. If it's found in the table's body, it'll be handled here. If
                    // it's not even found in a \halign in the first place, it's invalid. If a \span is
                    // found in the table's body inside a cell, it acts like a regular alignment token.
                    // The only difference is that the two cells one either side of it are joined into
                    // one. Everything that happens for an alignment token also happens for this, ex-
                    // cept the creation of a new cell.

                    if (!e.scopes.last.isHalignCell || e.contexts.last != 'scope') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    // The \span was in the \haling table. Treat it like an alignment character. The
                    // code below was copied from where alignment tokens are parsed in the top level
                    // parser.
                    var row = e.scopes[e.scopes.length - 2].cellData[e.scopes[e.scopes.length - 2].cellData.length - 1],
                        halignScope = e.scopes[e.scopes.length - 2];
                    if (!row[row.length - 1].omit && !this.postPreamble) {
                        var column = -1,
                            tokens;
                        for (var i = 0, l = row.length; i < l; i++) {
                            column += row[i].span;
                        }
                        if (halignScope.preamble[column]) tokens = halignScope.preamble[column][1];
                        else if (~halignScope.repeatPreambleAt) {
                            var repeatable = halignScope.preamble.slice(halignScope.repeatPreambleAt, halignScope.preamble.length);
                            tokens = repeatable[(column - halignScope.repeatPreambleAt) % repeatable.length][1];
                        } else {
                            this.invalid = true;
                            this.recognized = true;
                            return [this];
                        }
                        if (!halignScope.preamble[column + 1] && !~halignScope.repeatPreambleAt) {
                            this.invalid = true;
                            this.recognized = true;
                            return [this];
                        }
                        this.postPreamble = true;
                        return tokens.concat(this);
                    }

                    e.contexts.pop();
                    var tokens = e.scopes.last.tokens;
                    if (e.scopes.last.isFrac) {
                        row[row.length - 1].content.push({
                            type: 'atom',
                            atomType: 'inner',
                            nucleus: [{
                                type: 'fraction',
                                numerator: e.scopes.last.fracNumerator,
                                denominator: tokens,
                                barWidth: e.scopes.last.barWidth,
                                delims: [e.scopes.last.fracLeftDelim, e.scopes.last.fracRightDelim],
                                nullDelimiterSpace: new DimenReg(e.scopes.last.registers.named.nulldelimiterspace)
                            }],
                            superscript: null,
                            subscript: null
                        });
                        e.scopes.pop();
                    } else {
                        e.scopes.pop();
                        row[row.length - 1].content = row[row.length - 1].content.concat(tokens);
                    }

                    var spanOmitSym = Symbol();
                    e.mouth.saveState(spanOmitSym);

                    // Since a new cell isn't being created, the old cell's `omit' value has to be re-
                    // set since it's applying to a new section of the cell. The content after the
                    // \span all the way up until the next \span, \cr, or alignment token all counts
                    // as its own cell and the preamble for that cell needs to be added in to it if
                    // necessary.
                    row[row.length - 1].omit = false;
                    // The last cell's `span' value goes up so the HTML generator knows how many col-
                    // umns the cell should span when generated.
                    row[row.length - 1].span++;

                    while (true) {
                        var token = e.mouth.eat();

                        if (!token) {
                            e.mouth.loadState(spanOmitSym);
                            break;
                        } else if (token.type == 'character' && token.cat != data.cats.active) {
                            e.mouth.loadState(spanOmitSym);
                            break;
                        } else if (token.type == 'command' || token.type == 'character' && token.cat == data.cats.active) {
                            if (token.name in e.scopes.last.registers.named) {
                                e.mouth.loadState(spanOmitSym);
                                break;
                            }

                            var macro = token.type == 'command' ? e.scopes.last.defs.primitive[token.name] || e.scopes.last.defs.macros[token.name] : e.scopes.last.defs.active[token.char];

                            if (!macro) {
                                e.mouth.loadState(spanOmitSym);
                                break;
                            }
                            if ((macro === data.defs.primitive.the          || macro.proxy && macro.original === data.defs.primitive.the)          ||
                                (macro === data.defs.primitive.expandafter  || macro.proxy && macro.original === data.defs.primitive.expandafter)  ||
                                (macro === data.defs.primitive.number       || macro.proxy && macro.original === data.defs.primitive.number)       ||
                                (macro === data.defs.primitive.romannumeral || macro.proxy && macro.original === data.defs.primitive.romannumeral) ||
                                (macro === data.defs.primitive.csname       || macro.proxy && macro.original === data.defs.primitive.csname)       ||
                                (macro === data.defs.primitive.string       || macro.proxy && macro.original === data.defs.primitive.string)       ||
                                (macro === data.defs.primitive.if           || macro.isLet && macro.original === data.defs.primitive.if)           ||
                                (macro === data.defs.primitive.ifcase       || macro.isLet && macro.original === data.defs.primitive.ifcase)       ||
                                (macro === data.defs.primitive.ifcat        || macro.isLet && macro.original === data.defs.primitive.ifcat)        ||
                                (macro === data.defs.primitive.ifdim        || macro.isLet && macro.original === data.defs.primitive.ifdim)        ||
                                (macro === data.defs.primitive.ifeof        || macro.isLet && macro.original === data.defs.primitive.ifeof)        ||
                                (macro === data.defs.primitive.iffalse      || macro.isLet && macro.original === data.defs.primitive.iffalse)      ||
                                (macro === data.defs.primitive.ifodd        || macro.isLet && macro.original === data.defs.primitive.ifodd)        ||
                                (macro === data.defs.primitive.ifnum        || macro.isLet && macro.original === data.defs.primitive.ifnum)        ||
                                (macro === data.defs.primitive.ifhmode      || macro.isLet && macro.original === data.defs.primitive.ifhmode)      ||
                                (macro === data.defs.primitive.ifinner      || macro.isLet && macro.original === data.defs.primitive.ifinner)      ||
                                (macro === data.defs.primitive.ifmmode      || macro.isLet && macro.original === data.defs.primitive.ifmmode)      ||
                                (macro === data.defs.primitive.iftrue       || macro.isLet && macro.original === data.defs.primitive.iftrue)       ||
                                (macro === data.defs.primitive.ifvmode      || macro.isLet && macro.original === data.defs.primitive.ifvmode)      ||
                                (macro === data.defs.primitive.ifvoid       || macro.isLet && macro.original === data.defs.primitive.ifvoid)       ||
                                (macro === data.defs.primitive.ifx          || macro.isLet && macro.original === data.defs.primitive.ifx)) {
                                var expansion = e.mouth.expand(token, e.mouth);
                                if (expansion.length == 1 && expansion[0] === token && token.invalid) {
                                    e.mouth.loadState(spanOmitSym);
                                    break;
                                }
                                e.mouth.queue.unshift.apply(e.mouth.queue, expansion);
                                continue;
                            } else if (macro === data.defs.primitive.omit || macro.proxy && macro.original === data.defs.primitive.omit) {
                                row[row.length - 1].omit = true;
                                break;
                            }

                            if (macro.type == 'primitive' || macro.proxy && macro.original.type == 'primitive') {
                                e.mouth.loadState(spanOmitSym);
                                break;
                            }

                            var expansion = e.mouth.expand(token, e.mouth);
                            if (expansion.length == 1 && expansion[0] ==- token && token.invalid) {
                                e.mouth.loadState(spanOmitSym);
                                break;
                            }
                            e.mouth.queue.unshift.apply(e.mouth.queue, expansion);
                        }
                    }

                    // Open a new scope for the new cell.
                    e.contexts.push('scope');
                    new e.Scope();
                    e.scopes.last.isHalignCell = true;

                    // If the cell wasn't marked as `omit', the preamble for the new column needs to be
                    // evaluated.
                    if (!row[row.length - 1].omit) {
                        var column = -1;
                        for (var i = 0, l = row.length; i < l; i++) {
                            column += row[i].span;
                        }
                        if (halignScope.preamble[column]) {
                            tokens = halignScope.preamble[column][0];
                        } else if (~halignScope.repeatPreambleAt) {
                            var repeatable = halignScope.preamble.slice(halignScope.repeatPreambleAt, halignScope.preamble.length);
                            tokens = repeatable[(column - halignScope.repeatPreambleAt) % repeatable.length][0];
                        }
                        e.mouth.queue.unshift.apply(e.mouth.queue, tokens);
                    }
                }),
                radical: new Primitive('sqrt', function(e) {
                    // Normally, \radical accepts a numerical argument to dictate which character to
                    // display as the radical. This version though only accepts the normal radical sym-
                    // bol (U+221A), which doesn't really take away any functionality since why else
                    // would you EVER use \radical without the actual radical symbol? It just simplif-
                    // ies a task that would take forever to implement.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    e.tokens.push({
                        type: 'family modifier',
                        value: 'rad',
                        token: this
                    });
                    return [];
                }),
                string: new Primitive('string', function(e) {
                    // \string returns a list of catcode 12 tokens that represent the next token. If
                    // the next token is a character, then the character is returned by itself with
                    // its catcode set to 12. If it's a command, then multiple character tokens are
                    // returned that spell out the command name.

                    var token = e.mouth.eat();
                    if (!token) {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    if (token.type == 'character') {
                        return [{
                            type: 'character',
                            cat: data.cats.all,
                            char: token.char,
                            code: token.code
                        }];
                    } else if (token.type == 'command') {
                        return (String.fromCharCode(e.scopes.last.registers.named.escapechar.value) + token.name).split('').map(function(char) {
                            return {
                                type: 'character',
                                cat: data.cats.all,
                                char: char,
                                code: char.charCodeAt(0)
                            };
                        });
                    } else {
                        this.invalid = true;
                        this.recognized = true;
                        e.mouth.revert();
                        return [this];
                    }
                }),
                textstyle: new Primitive('textstyle', function(e) {
                    // \textstyle makes all the characters in the rest of the scope appear as an inline
                    // equation.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    e.tokens.push({
                        type: 'font modifier',
                        value: 'textstyle'
                    });
                    return [];
                }),
                the: new Primitive('the', function(e) {
                    // The \the command creates a list of tokens from a register. Integer registers
                    // return just plain numbers. Dimensions return a decimal number followed by "pt".
                    // Glues return a dimension along with "plus x minus y" if the glue has nonzero
                    // stretch (x) and shrink (y) values.

                    var theSym = Symbol()
                    e.mouth.saveState(theSym);

                    while (true) {
                        var token = e.mouth.eat();

                        if (token && (token.type == 'command' || token.type == 'character' && token.cat == data.cats.active)) {
                            var expansion = e.mouth.expand(token, e.mouth);

                            e.mouth.queue.unshift.apply(e.mouth.queue, expansion);
                        } else if (token && token.register) {
                            if (token.type == 'integer') {
                                return token.value.toString().split('').map(function(element) {
                                    return {
                                        type: 'character',
                                        cat: data.cats.all,
                                        char: element,
                                        code: element.charCodeAt(0)
                                    };
                                });
                            } else if (token.type == 'dimension') {
                                var pts = Math.round(token.sp.value / 65536 * 100000) / 100000;
                                pts += (Math.round(token.em.value / 65536 * 100000) / 100000) * 12;
                                return (pts + (Number.isInteger(pts) ? '.0pt' : 'pt')).split('').map(function(element) {
                                    return {
                                        type: 'character',
                                        cat: data.cats.all,
                                        char: element,
                                        code: element.charCodeAt(0)
                                    };
                                });
                            } else if (token.type == 'mu dimension') {
                                var mus = Math.round(token.mu.value / 65536 * 100000) / 100000;
                                return (mus + (Number.isInteger(mus) ? '.0mu' : 'mu')).split('').map(function(element) {
                                    return {
                                        type: 'character',
                                        cat: data.cats.all,
                                        char: element,
                                        code: element.charCodeAt(0)
                                    };
                                });
                            } else if (token.type == 'glue') {
                                var string = '',
                                    pts = Math.round(token.start.sp.value / 65536 * 100000) / 100000;
                                    pts += (Math.round(token.start.em.value / 65536 * 100000) / 100000) * 12;
                                string = pts + (Number.isInteger(pts) ? '.0pt' : 'pt');
                                if (token.stretch instanceof DimenReg && (token.stretch.sp.value || token.stretch.em.value)) {
                                    pts = Math.round(token.stretch.sp.value / 65536 * 100000) / 100000;
                                    pts += (Math.round(token.stretch.em.value / 65536 * 100000) / 100000) * 12;
                                    string += ' plus ' + pts + (Number.isInteger(pts) ? '.0pt' : 'pt');
                                } else if (token.stretch instanceof InfDimen && token.stretch.number.value) {
                                    var fils = Math.round(token.stretch.number.value / 65536 * 100000) / 100000;
                                    string += ' plus ' + fils + (Number.isInteger(fils) ? '.0' : '') + 'fil' + new Array(token.stretch.magnitude.value).join('l');
                                }
                                if (token.shrink instanceof DimenReg && (token.shrink.sp.value || token.shrink.em.value)) {
                                    pts = Math.round(token.shrink.sp.value / 65536 * 100000) / 100000;
                                    pts += (Math.round(token.shrink.em.value / 65536 * 100000) / 100000) * 12;
                                    string += ' minus ' + pts + (Number.isInteger(pts) ? '.0pt' : 'pt');
                                } else if (token.shrink instanceof InfDimen && token.shrink.number.value) {
                                    var fils = Math.round(token.shrink.number.value / 65536 * 100000) / 100000;
                                    string += ' minus ' + fils + (Number.isInteger(fils) ? '.0' : '') + 'fil' + new Array(token.shrink.magnitude.value).join('l');
                                }
                                return string.split('').map(function(element) {
                                    return {
                                        type: 'character',
                                        cat: data.cats.all,
                                        char: element,
                                        code: element.charCodeAt(0)
                                    };
                                });
                            } else if (token.type == 'mu glue') {
                                var string = '',
                                    mus = Math.round(token.start.mu.value / 65536 * 100000) / 100000;
                                string = mus + (Number.isInteger(mus) ? '.0mu' : 'mu');
                                if (token.stretch instanceof MuDimenReg && token.stretch.mu.value) {
                                    mus = Math.round(token.stretch.mu.value / 65536 * 100000) / 100000;
                                    string += ' plus ' + mus + (Number.isInteger(mus) ? '.0mu' : 'mu');
                                } else if (token.stretch instanceof InfDimen && token.stretch.number.value) {
                                    var fils = Math.round(token.stretch.number.value / 65536 * 100000) / 100000;
                                    string += ' plus ' + fils + (Number.isInteger(fils) ? '.0' : '') + 'fil' + new Array(token.stretch.magnitude.value).join('l');
                                }
                                if (token.shrink instanceof MuDimenReg && token.shrink.mu.value) {
                                    mus = Math.round(token.shrink.mu.value / 65536 * 100000) / 100000;
                                    string += ' minus ' + mus + (Number.isInteger(mus) ? '.0mu' : 'mu');
                                } else if (token.shrink instanceof InfDimen && token.shrink.number.value) {
                                    var fils = Math.round(token.shrink.number.value / 65536 * 100000) / 100000;
                                    string += ' minus ' + fils + (Number.isInteger(fils) ? '.0' : '') + 'fil' + new Array(token.shrink.magnitude.value).join('l');
                                }
                                return string.split('').map(function(element) {
                                    return {
                                        type: 'character',
                                        cat: data.cats.all,
                                        char: element,
                                        code: element.charCodeAt(0)
                                    };
                                });
                            }
                        } else {
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(theSym);
                            return [this];
                        }
                    }
                }),
                time: new Primitive('time', function(e) {
                    // Returns the current time of the day as minutes since midnight.

                    var date = new Date();
                    return [new IntegerReg(date.getHours() * 60 + date.getMinutes())];
                }),
                uccode: new Primitive('uccode', function(e) {
                    // Uppercase version of \lccode.

                    var integer = e.mouth.eat('integer');

                    if (integer || integer.value < 0) {
                        return [e.scopes.last.uc[integer.value] = e.scopes.last.uc[integer.value] || new IntegerReg(0)];
                    } else {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }
                }),
                underline: new Primitive('underline', function(e) {
                    // Underline version of \overline.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    e.tokens.push({
                        type: 'family modifier',
                        value: 'under',
                        token: this
                    });
                    return [];
                }),
                uppercase: new Primitive('uppercase', function(e) {
                    // \uppercase is analogous to \lowercase. It converts character to their uppercase
                    // values.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var ucSym = Symbol();
                    e.mouth.saveState(ucSym);

                    var open = e.mouth.eat();
                    if (!open || open.cat != data.cats.open) {
                        this.invalid = true;
                        this.recognized = true;
                        e.mouth.loadState(ucSym);
                        return [this];
                    }

                    var tokens = [],
                        groups = 1;
                    while (true) {
                        var token = e.mouth.eat('pre space');

                        if (!token) {
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(ucSym);
                            return [this];
                        } else if (token.type == 'character' && token.cat == data.cats.open) {
                            groups++;
                            tokens.push(token);
                        } else if (token.type == 'character' && token.cat == data.cats.close) {
                            groups--;
                            if (groups > 0) tokens.push(token);
                            else break;
                        } else tokens.push(token);
                    }

                    for (var i = 0, l = tokens.length; i < l; i++) {
                        if (tokens[i].type == 'character' && e.scopes.last.uc[tokens[i].code] && e.scopes.last.uc[tokens[i].code].value > 0) {
                            tokens[i].code = e.scopes.last.uc[tokens[i].code].value;
                            tokens[i].char = String.fromCharCode(tokens[i].code);
                        }
                    }
                    return tokens;
                }),
                vbox: new Primitive('vbox', function(e) {
                    // \vbox is analogous to \hbox except the "to" or "spread" will affect its height
                    // instead of its width. Look at \hbox for comments.
                    var vboxSym = Symbol();
                    e.mouth.saveState(vboxSym);
                    var spread, to;
                    while (true) {
                        var token = e.mouth.eat();
                        if (!token) {
                            this.invalid = true;
                            this.recognized = true;
                            return [this];
                        }
                        if (token.type == 'command' || token.type == 'character' && token.cat == data.cats.active) {
                            var macro = token.type == 'command' ? e.scopes.last.defs.primitive[token.name] || e.scopes.last.defs.macros[token.name] : e.scopes.last.defs.active[token.char];
                            if (macro && (macro === data.defs.primitive.relax || macro.proxy && macro.original === data.defs.primitive.relax)) break;
                            var expansion = e.mouth.expand(token, e.mouth);
                            e.mouth.queue.unshift.apply(e.mouth.queue, expansion);
                            continue;
                        } else if (token.type == 'character' && (token.char == 't' || token.char == 'T')) {
                            var o = e.mouth.eat('pre space');
                            if (o && o.type == 'character' && (o.char == 'o' || token.char == 'O') && token.cat != data.cats.active) {
                                var dimen = e.mouth.eat('dimension');
                                if (dimen) {
                                    to = dimen;
                                    break;
                                } else {
                                    this.invalid = true;
                                    this.recognized = true;
                                    e.mouth.loadState(vboxSym);
                                    return [this];
                                }
                            } else {
                                this.invalid = true;
                                this.recognized = true;
                                e.mouth.loadState(vboxSym);
                                return [this];
                            }
                        } else if (token.type == 'character' && (token.char == 's' || token.char == 'S')) {
                            var p = e.mouth.eat(),
                                r = e.mouth.eat(),
                                E = e.mouth.eat(),
                                a = e.mouth.eat(),
                                d = e.mouth.eat();
                            if (!p || p.type != 'character' || p.char != 'p' && p.char != 'P' || p.cat == data.cats.active ||
                                !r || r.type != 'character' || r.char != 'r' && r.char != 'R' || r.cat == data.cats.active ||
                                !E || E.type != 'character' || E.char != 'e' && E.char != 'E' || E.cat == data.cats.active ||
                                !a || a.type != 'character' || a.char != 'a' && a.char != 'A' || a.cat == data.cats.active ||
                                !d || d.type != 'character' || d.char != 'd' && d.char != 'D' || d.cat == data.cats.active) {
                                this.invalid = true;
                                this.recognized = true;
                                e.mouth.loadState(vboxSym);
                                return [this];
                            }
                            var dimen = e.mouth.eat('dimension');
                            if (dimen) {
                                spread = dimen;
                                break;
                            } else {
                                this.invalid = true;
                                this.recognized = true;
                                e.mouth.loadState(vboxSym);
                                return [this];
                            }
                        } else if (token.type == 'character' && token.cat == data.cats.open) {
                            e.mouth.revert();
                            return [];
                        } else {
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(vboxSym);
                            return [this];
                        }
                    }
                    var open = e.mouth.preview();
                    if (!open || open.type != 'character' || open.cat != data.cats.open) {
                        this.invalid = true;
                        this.recognized = true;
                        e.mouth.loadState(vboxSym);
                        return [this];
                    }
                    if (!spread && to.sp.value == 0 && to.em.value == 0 || !to && spread.sp.value == 0 && spread.em.value == 0) return [];
                    e.tokens.push({
                        type: 'box wrapper',
                        value: 'vertical',
                        to: to,
                        spread: spread,
                        token: this
                    });
                    return [];
                }),
                vcenter: new Primitive('vcenter', function(e) {
                    // \vcenter creates a Vcent atom using the atom immediately following the \vcenter.
                    // A Vcent atom will be rendered exactly like an Ord atom, except that it will be
                    // centered vertically on the line when rendered.
                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    // A temporary atom is added to the token list, similar to how \accent works.
                    e.tokens.push({
                        type: 'family modifier',
                        value: 'vcenter',
                        token: this
                    });
                    return [];
                }),
                vfil: new Primitive('vfil', function(e) {
                    // \vfil makes a vertical glue that is analogous to \hfil.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    e.tokens.push({
                        type: 'vglue',
                        glue: new GlueReg(new DimenReg(0), new InfDimen(1, 1), new DimenReg(0))
                    });
                    return [];
                }),
                vfill: new Primitive('vfill', function(e) {
                    // Vertical glue version of \hfill.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    e.tokens.push({
                        type: 'vglue',
                        glue: new GlueReg(new DimenReg(0), new InfDimen(1, 2), new DimenReg(0))
                    });
                    return [];
                }),
                vskip: new Primitive('vskip', function(e) {
                    // Verical version of \hskip.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }

                    var glue = e.mouth.eat('glue');
                    if (!glue) {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }
                    e.tokens.push({
                        type: 'vglue',
                        glue: glue
                    });
                    return [];
                }),
                xdef: new Primitive('xdef', function(e) {
                    // \xdef is like a combination of \gdef and \edef. All the code below was copied
                    // from \edef, so look there for comments and stuff.

                    if (e.contexts.last == 'superscript' || e.contexts.last == 'subscript') {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }
                    var defSym = Symbol();
                    e.mouth.saveState(defSym);
                    var name = e.mouth.eat();
                    if (!name) {
                        this.invalid = true;
                        this.recognized = true;
                        return [this];
                    }
                    var type;
                    if (name.type == 'character') {
                        if (e.catOf(name.char) == data.cats.active) {
                            type = 'active';
                            name = name.char;
                        } else {
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(defSym);
                            return [this];
                        }
                    } else if (name.type == 'command') {
                        type = 'macro';
                        name = name.name;
                        if (name in e.scopes.last.defs.primitive || name in data.parameters) {
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(defSym);
                            return [this];
                        }
                    }
                    var params = [],
                        used = 0,
                        endInOpen = false;
                    while (true) {
                        var token = e.mouth.eat();
                        if (!token) {
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(defSym);
                            return [this];
                        } else if (token.cat == data.cats.open) {
                            e.mouth.revert();
                            break;
                        } else if (token.cat == data.cats.param) {
                            var paramTok = e.mouth.eat('pre space');
                            if (!paramTok) {
                                this.invalid = true;
                                this.recognized = true;
                                e.mouth.loadState(defSym);
                                return [this];
                            } else if (paramTok.cat == data.cats.open) {
                                endInOpen = true;
                                e.mouth.revert();
                                params.push({
                                    type: 'character',
                                    cat: data.cats.open,
                                    char: paramTok.char,
                                    code: paramTok.code
                                })
                            } else if (48 < paramTok.code && paramTok.code < 58 && paramTok.cat == data.cats.all && +paramTok.char == used + 1) {
                                params.push(token);
                                used++;
                            } else {
                                this.invalid = true;
                                this.recognized = true;
                                e.mouth.loadState(defSym);
                                return [this];
                            }
                        } else params.push(token);
                    }
                    var openGroups = 0,
                        replacement = [],
                        noexpand = false,
                        skip = false;
                    while (true) {
                        var token = e.mouth.eat();
                        if (!token) {
                            this.invalid = true;
                            this.recognized = true;
                            e.mouth.loadState(defSym);
                            return [this];
                        } else if (token.type == 'character' && token.cat == data.cats.param && !skip) {
                            var index = e.mouth.eat('pre space');
                            if (index && (index.cat == data.cats.param || (index.cat == data.cats.all && index.char <= params.length && index.char >= 1))) {
                                e.mouth.revert();
                                if (index.cat == data.cats.param) skip = true;
                            } else {
                                this.invalid = true;
                                this.recognized = true;
                                e.mouth.loadState(defSym);
                                return [this];
                            }
                            replacement.push(token);
                            noexpand = false;
                        } else if (token.type == 'character' && token.cat == data.cats.open) {
                            openGroups++;
                            replacement.push(token);
                            noexpand = false;
                        } else if (token.type == 'character' && token.cat == data.cats.close) {
                            openGroups--;
                            if (openGroups == 0) break;
                            replacement.push(token);
                            noexpand = false;
                        } else if (noexpand) {
                            replacement.push(token);
                            noexpand = false;
                        } else if (token.type == 'command' || token.type == 'character' && token.cat == data.cats.active) {
                            if (token.name in e.scopes.last.registers.named) {
                                replacement.push(token);
                                continue;
                            }
                            var macro = token.type == 'command' ? e.scopes.last.defs.primitive[token.name] || e.scopes.last.defs.macros[token.name] : e.scopes.last.defs.active[token.char];
                            if (!macro) {
                                this.invalid = true;
                                this.recognized = true;
                                e.mouth.loadState(defSym);
                                return [this];
                            }
                            if ((macro === data.defs.primitive.the          || macro.proxy && macro.original === data.defs.primitive.the)          ||
                                (macro === data.defs.primitive.expandafter  || macro.proxy && macro.original === data.defs.primitive.expandafter)  ||
                                (macro === data.defs.primitive.number       || macro.proxy && macro.original === data.defs.primitive.number)       ||
                                (macro === data.defs.primitive.romannumeral || macro.proxy && macro.original === data.defs.primitive.romannumeral) ||
                                (macro === data.defs.primitive.csname       || macro.proxy && macro.original === data.defs.primitive.csname)       ||
                                (macro === data.defs.primitive.string       || macro.proxy && macro.original === data.defs.primitive.string)       ||
                                (macro === data.defs.primitive.if           || macro.isLet && macro.original === data.defs.primitive.if)           ||
                                (macro === data.defs.primitive.ifcase       || macro.isLet && macro.original === data.defs.primitive.ifcase)       ||
                                (macro === data.defs.primitive.ifcat        || macro.isLet && macro.original === data.defs.primitive.ifcat)        ||
                                (macro === data.defs.primitive.ifdim        || macro.isLet && macro.original === data.defs.primitive.ifdim)        ||
                                (macro === data.defs.primitive.ifeof        || macro.isLet && macro.original === data.defs.primitive.ifeof)        ||
                                (macro === data.defs.primitive.iffalse      || macro.isLet && macro.original === data.defs.primitive.iffalse)      ||
                                (macro === data.defs.primitive.ifodd        || macro.isLet && macro.original === data.defs.primitive.ifodd)        ||
                                (macro === data.defs.primitive.ifnum        || macro.isLet && macro.original === data.defs.primitive.ifnum)        ||
                                (macro === data.defs.primitive.ifhmode      || macro.isLet && macro.original === data.defs.primitive.ifhmode)      ||
                                (macro === data.defs.primitive.ifinner      || macro.isLet && macro.original === data.defs.primitive.ifinner)      ||
                                (macro === data.defs.primitive.ifmmode      || macro.isLet && macro.original === data.defs.primitive.ifmmode)      ||
                                (macro === data.defs.primitive.iftrue       || macro.isLet && macro.original === data.defs.primitive.iftrue)       ||
                                (macro === data.defs.primitive.ifvmode      || macro.isLet && macro.original === data.defs.primitive.ifvmode)      ||
                                (macro === data.defs.primitive.ifvoid       || macro.isLet && macro.original === data.defs.primitive.ifvoid)       ||
                                (macro === data.defs.primitive.ifx          || macro.isLet && macro.original === data.defs.primitive.ifx)) {
                                var expansion = e.mouth.expand(token, e.mouth);
                                if (expansion.length == 1 && expansion[0] === token && token.invalid) {
                                    this.invalid = true;
                                    this.recognized = true;
                                    e.mouth.loadState(defSym);
                                    return [this];
                                }
                                e.mouth.queue.unshift.apply(e.mouth.queue, expansion);
                                continue;
                            } else if (macro === data.defs.primitive.noexpand || macro.proxy && macro.original === data.defs.primitive.noexpand) {
                                noexpand = true;
                                continue;
                            }
                            if (macro instanceof Primitive || macro.proxy && macro.original instanceof Primitive) {
                                replacement.push(token);
                                continue;
                            }
                            e.mouth.queue.unshift.apply(e.mouth.queue, e.mouth.expand(token, e.mouth));
                        } else replacement.push(token);
                    }

                    replacement.shift();
                    if (endInOpen) replacement.push(params[params.length - 1]);
                    var macro = new Macro(replacement, params);
                    if (e.scopes.last.registers.named.globaldefs.value < 0) {
                        e.scopes.last.defs[type == 'macro' ? 'macros' : 'active'][name] = macro;
                        delete e.scopes.last.registers.named[name];
                    } else {
                        if (type == 'macro') {
                            data.defs.macros[name] = macro;
                            delete data.registers.named[name];
                            for (var i = 0, l = e.scopes.length; i < l; i++) {
                                e.scopes[i].defs.macros[name] = macro;
                                delete e.scopes.last.registers.named[name];
                            }
                        } else {
                            data.defs.active[name] = macro;
                            delete data.registers.named[name];
                            for (var i = 0, l = e.scopes.length; i < l; i++) {
                                e.scopes[i].defs.ative[name] = macro;
                                delete e.scopes.last.registers.named[name];
                            }
                        }
                    }
                    e.toggles.global = false;
                    return [];
                }),
                year: new Primitive('year', function(e) {
                    // Returns the current year.

                    return [new IntegerReg(new Date().getFullYear())];
                }),
                "@debug": new Primitive('@debug', function(e) {
                    // This primitive allows for debugging macros. It expands to nothing, but also
                    // "calls" `debugger'. This freezes TeX and lets you debug what's happening in
                    // the console (only works if the developer tools are open in the browser since
                    // that's just how `debugger' works).
                    debugger
                }),
                "@exec@JavaScript": new Primitive('@exec@JavaScript', function(e) {
                    // \execJ@v@Script is a custom fontTeX-only primitive that will execute any tokens
                    // the follow it. If it's a single token, then it is compiled into a string and
                    // executed (using `eval'). The value returned is then converted into another
                    // string and parsed. If the first token after the \execJ@v@Script is an opening
                    // token, all the tokens up to the next closing tokens will be compiled into a
                    // string and executed. An example of its usage is \execJ@v@Script1, which would
                    // parse the "1" as JavaScript, which would then return the number 1, which would
                    // then be converted to a string, which would then be parsed using TeX, which would
                    // just result in a "1" atom. Obviously, nothing special here. Another, more excit-
                    // ing example would be:
                    // \execJ@v@Script{(function() {
                    //     var number = 5, string = "STRING";
                    //     return new Array(number).join(string);
                    // })()}
                    // That of course would be assuming the "}" token that closes the function was al-
                    // ready parsed and has a catcode other 2. In the case above, notice that Java-
                    // Script syntax can collide with TeX syntax. For example, the modulo operator in
                    // JavaScript (%) is recognized as the start of a comment in TeX, which would lead
                    // to some improper parsing. That's why the JavaScript environment exists. Instead
                    // of using \execJ@v@Script, use \begin{JavaScript} ... \end{JavaScript}.
                })
            },
            macros: {
                // This is where user-defined macros are stored. They can be either plain macros
                // that get replaced with a list of tokens (defined using \def), or proxy macros
                // that are references to other macros (defined using \let). \let stores a refer-
                // ence to the original macro, not the reference to the original macro. In other
                // words, using `\let\new=\old' stores the \old macro at \new. If \old gets redef-
                // ined later, a new macro is stores as its value, but its new macro doesn't affect
                // the old macro stored at \new. This object is initially empty because built-in
                // macros (like \sqrt, which is a macro built on top of \radical) are defined in
                // a piece of TeX that is run before the script is finished executing. The defin-
                // itions are below, after the `data' object's definition. This object also holds
                // named registers (defined using \countdef, \dimendef, etc.).
            },
            active: {
                // This is where active characters' definitions are stored. In plain TeX, only the
                // tilde ~ character is an active character that evaluates to a no-break-space
                // character. The tilde character's definition is below, after the `data' object's
                // definition. The apostrophe character also has an active character definition,
                // even though it isn't an active character. Because it has mathcode 8 though, its
                // active character definition is used (in this case, an apostrophe translates to
                // "^{\prime}" assuming \prime expands to ′).
                "'": new Macro([
                    {
                        type: 'character',
                        cat: 7,
                        char: '^',
                        code: 94
                    },{
                        type: 'character',
                        cat: 1,
                        char: '{',
                        code: 123
                    },{
                        type: 'character',
                        cat: 12,
                        char: '′',
                        code: 8242
                    },{
                        type: 'character',
                        cat: 2,
                        char: '}',
                        code: 125
                    }
                ], [])
            }
        },
        registers: {
            // Plain TeX can normally only store 255 registers of each type. In this version
            // though, up to 65536 registers are allowed just because there's no real reason to
            // limit the maximum register count here. Count registers hold integer values. In
            // TeX, integers are 32-bit, but JavaScript allows for 64-bit integers, so the max-
            // imum value in this version is 9007199254740991 as opposed to 2147483647. Dimen
            // registers hold dimension objects (which are basically just integers with a sp
            // unit attached). Skip registers hold glue objects (dimension objects with two
            // additional dimensions). Mukip registers are like skip registers except all three
            // units are in terms of math units.
            count: {},
            dimen: {},
            skip: {},
            muskip: {},
            named: {
                // Named registers are those like \escapechar that hold special values. \escapechar
                // for example is an integer representing the character code of the default escape
                // character (starts off as the charCode of `\').There are other non-integer regis-
                // ters as well, like \thinmuskip (the space inserted when using `\,'). Some regis-
                // ters below have comments next to them explaining their purpose. Most don't
                // though because a lot of the registers don't apply to this version of Tex. Only
                // math mode is rendered here, so a lot of the registers are obsolete, but are in-
                // cluded for consistency with real TeX.
                // - Integer Registers
                pretolerance: new IntegerReg(100),
                tolerance: new IntegerReg(200),
                hbadness: new IntegerReg(1000),
                vbadness: new IntegerReg(1000),
                linepenalty: new IntegerReg(10),
                hypenpenalty: new IntegerReg(50),
                exhyphenpenalty: new IntegerReg(50),
                binoppenalty: new IntegerReg(700),
                relpenalty: new IntegerReg(500),
                clubpenalty: new IntegerReg(150),
                widowpenalty: new IntegerReg(150),
                displaywidowpenalty: new IntegerReg(50),
                brokenpenalty: new IntegerReg(100),
                predisplaypenalty: new IntegerReg(10000),
                postdisplaypenalty: new IntegerReg(0),
                floatingpenalty: new IntegerReg(0),
                interlinepenalty: new IntegerReg(0),
                outputpenalty: new IntegerReg(-10001),
                doublehyphendemerits: new IntegerReg(10000),
                finalhyphendemerits: new IntegerReg(5000),
                adjdemerits: new IntegerReg(10000),
                looseness: new IntegerReg(0),
                pausing: new IntegerReg(0),
                holdinginserts: new IntegerReg(0),
                tracingonline: new IntegerReg(0),
                tracingmacros: new IntegerReg(0),
                tracingstats: new IntegerReg(0),
                tracingparagraphs: new IntegerReg(0),
                tracingpages: new IntegerReg(0),
                tracingoutput: new IntegerReg(0),
                tracinglostchars: new IntegerReg(0),
                tracingcommands: new IntegerReg(0),
                tracingrestores: new IntegerReg(0),
                language: new IntegerReg(0),
                uchyph: new IntegerReg(1),
                lefthyphenmin: new IntegerReg(2),
                righthyphenmin: new IntegerReg(3),
                globaldefs: new IntegerReg(0),
                defaulthyphenchar: new IntegerReg(45),
                defaultskewchar: new IntegerReg(-1),
                escapechar: new IntegerReg(92),
                endlinechar: new IntegerReg(13),
                newlinechar: new IntegerReg(10),
                maxdeadcycles: new IntegerReg(100),
                hangafter: new IntegerReg(1),
                fam: new IntegerReg(0),
                mag: new IntegerReg(1000),
                delimiterfactor: new IntegerReg(901),
                showboxbreadth: new IntegerReg(-1),
                showboxdepth: new IntegerReg(-1),
                errorcontextlines: new IntegerReg(-1),
                // There are also \time, \day, \month, and \year registers. In normal TeX, since
                // the entire document is made in one go, there's only ever a need to set those
                // registers once at the beginning and leave them. With this version of TeX though,
                // TeX can be rendered at different times. That means those time registers have to
                // always be up-to-date. Instead of handling them like normal registers then, they
                // are treated like primitives. They return an integer token according to their re-
                // spective name.
                // - Dimension Registers
                hfuzz: new DimenReg(65536 * 0.1, 0),
                vfuzz: new DimenReg(65536 * 0.1, 0),
                overfullrule: new DimenReg(0, 0),
                emergencystetch: new DimenReg(0, 0),
                hsize: new DimenReg(65536 * 345, 0),
                vsize: new DimenReg(65536 * 550, 0),
                maxdepth: new DimenReg(65536 * 5, 0),
                splitmaxdepth: new DimenReg(65536 * 16394, -65536),
                boxmaxdepth: new DimenReg(65536 * 16394, -65536),
                lineskiplimit: new DimenReg(0, 0),
                delimitershortfall: new DimenReg(65536 * 5, 0),
                nulldelimiterspace: new DimenReg(65536 * 1.2, 0),
                scriptspace: new DimenReg(65536 * 0.5, 0),
                mathsurround: new DimenReg(0, 0),
                predisplaystyle: new DimenReg(0, 0),
                displaywidth: new DimenReg(0, 0),
                displayindent: new DimenReg(0, 0),
                parindent: new DimenReg(65536 * 15, 0),
                hangindent: new DimenReg(0, 0),
                hoffset: new DimenReg(0, 0),
                voffset: new DimenReg(0, 0),
                // - Glue Registers
                baselineskip: new GlueReg(new DimenReg(65536 * 12, 0)),
                lineskip: new GlueReg(new DimenReg(65536, 0)),
                parskip: new GlueReg(new DimenReg(0, 0), new DimenReg(65536, 0)),
                abovedisplayskip: new GlueReg(new DimenReg(65536 * 10, 0), new DimenReg(65536 * 2, 0), new DimenReg(65536 * 5, 0)),
                abovedisplayshortskip: new GlueReg(new DimenReg(0, 0), new DimenReg(65536 * 3, 0)),
                belowdisplayskip: new GlueReg(new DimenReg(0, 0), new DimenReg(65536 * 3, 0)),
                belowdisplayshortskip: new GlueReg(new DimenReg(65536 * 6, 0), new DimenReg(65536 * 3, 0), new DimenReg(65536 * 3, 0)),
                leftskip: new GlueReg(new DimenReg(0, 0)),
                rightskip: new GlueReg(new DimenReg(0, 0)),
                topskip: new GlueReg(new DimenReg(65536 * 10, 0)),
                splittopskip: new GlueReg(new DimenReg(65536 * 10, 0)),
                tabskip: new GlueReg(new DimenReg(0, 0)),
                spaceskip: new GlueReg(new DimenReg(0, 0)),
                xspaceskip: new GlueReg(new DimenReg(0, 0)),
                parfillskip: new GlueReg(new DimenReg(0, 0), new InfDimen(65536, 1)),
                // - MuGlue Registers
                thinmuskip: new MuGlueReg(new MuDimenReg(65536 * 3)),
                medmuskip: new MuGlueReg(new MuDimenReg(65536 * 4), new MuDimenReg(65536 * 2), new MuDimenReg(65536 * 4)),
                thickmuskip: new MuGlueReg(new MuDimenReg(65536 * 5), new MuDimenReg(65536 * 5))
            }
        },
        // Catcodes determine what type of behavior a character will exhibit. A catcode of
        // 1 for example means the character is an opening token (TeX's default is {). 2 is
        // a closing token. 3 - math shift ($), 4 - alignment (&), 5 - EOL (\n), 6 - param-
        // eter (#), 7 - superscript (^), 8 - subscript (_), 9 - ignored (NULL), 10 -
        // whitespace (SPACE and TAB), 11 - letters (a-z and A-Z), 12 - other (anything
        // doesn't fall into another catcode), 13 - active (~), 14 - comment (%), 15 - in-
        // valid (DELETE).
        cats: (function() {
            var obj = {
                0x5C: new IntegerReg(0),
                0x7B: new IntegerReg(1),
                0x7D: new IntegerReg(2),
                0x24: new IntegerReg(3),
                0x26: new IntegerReg(4),
                0x0A: new IntegerReg(5),
                0x23: new IntegerReg(6),
                0x5E: new IntegerReg(7),
                0x5F: new IntegerReg(8),
                0x00: new IntegerReg(9),
                0x09: new IntegerReg(10),
                0x20: new IntegerReg(10),
                0x7E: new IntegerReg(13),
                0x25: new IntegerReg(14),
                0x7F: new IntegerReg(15),
                escape: 0,
                open: 1,
                close: 2,
                math: 3,
                alignment: 4,
                eol: 5,
                param: 6,
                super: 7,
                sub: 8,
                ignored: 9,
                whitespace: 10,
                letter: 11,
                all: 12,
                active: 13,
                comment: 14,
                invalid: 15
            };
            for (var i = 0, l = 52; i < l; i++) {
                obj['abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.charCodeAt(i)] = new IntegerReg(11);
            }
            return obj;
        })(),
        // Math codes define what "family" a character falls into. It is used to determine
        // spacing between characters. For example, a "+" is a Bin(ary) operator and has
        // extra spacing around it to make "1+1" appear not as crunched together. The Vari-
        // able family is treated exactly like the Ord family except they are rendered in
        // italics. Other than that, they are basically synonymous with Ord.
        mathcodes: [
            'ΓΔΘΛΞΠΣΥΦΨΩℵℏıȷℓ℘∂∞′∅∇√⊤⊥∥∠△∖∀∃¬♭♮♯♣♢♡♠←⟵↑⇐⟸⇑→⟶↓⇒⟹⇓↔⟷↕⇔⟺⇕↦⟼↗↩↪↘↼⇀↙↽⇁↖⇌§¶@#$%^_|', // Ord(inary)
            '', // Op(erator)
            '+-*±∓∖⋅×∗⋆⋄∘∙÷∩∪⊎⊓⊔◃▹≀◯△▽∨∧⊕⊖⊗⊘⊙†‡⨿', // Bin(ary)
            '<>=:"≤≺⪯≪⊂⊆⊏⊑∈⊢⌣⌢≥≻⪰≫⊃⊇⊐⊒∋⊣≡∼≃≍≈≅⋈∝⊨≐⊥≮≰⊀⊄⊈⋢≯≱⊁⊅⊉⋣≠≢≁≄≆≭', // Rel(ation)
            '([{`', // Open
            '}])!?', // Close
            ',;', // Punct(uation)
            'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZαβγδϵεζηθϑικλμνξπϖρϱσςτυϕφχψω', // Variable
            "'" // Active
        ],
        delims: [
            // Lists the charCodes of each character allowed to be a delimiter (like after
            // \left). If a character is found in a delimiter context that doesn't have one of
            // the charCodes listed below, it is considered invalid.
            0x0028, // (
            0x0029, // )
            0x002E, // .
            0x003C, // <
            0x003E, // >
            0x002F, // /
            0x005B, // [
            0x005C, // \
            0x005D, // ]
            0x007B, // {
            0x007C, // |
            0x007D, // }
            0x2016, // ‖
            0x2191, // ↑
            0x2193, // ↓
            0x2195, // ↕
            0x21D1, // ⇑
            0x21D3, // ⇓
            0x21D5, // ⇕
            0x2225, // ∥
            0x2308, // ⌈
            0x2309, // ⌉
            0x230A, // ⌊
            0x230B, // ⌋
            0x23AA, // ⎪
            0x23B0, // ⎰
            0x23B1, // ⎱
            0x23D0, // ⏐
            0x27E8, // ⟨
            0x27E9, // ⟩
            0x27EE, // ⟮
            0x27EF, // ⟯
        ],
        // The `parameters' array contains strings of the names of all built-in parameters.
        // Since they are used in the code in this script, the user isn't able to redefine
        // new macros at these names. User-defined named registers can still be changed.
        parameters: [
            "pretolerance", "tolerance", "hbadness", "vbadness", "linepenalty", "hypenpenalty", "exhyphenpenalty", "binoppenalty", "relpenalty", "clubpenalty",
            "widowpenalty", "displaywidowpenalty", "brokenpenalty", "predisplaypenalty", "postdisplaypenalty", "floatingpenalty", "interlinepenalty", "outputpenalty",
            "doublehyphendemerits", "finalhyphendemerits", "adjdemerits", "looseness", "pausing", "holdinginserts", "tracingonline", "tracingmacros", "tracingstats",
            "tracingparagraphs", "tracingpages", "tracingoutput", "tracinglostchars", "tracingcommands", "tracingrestores", "language", "uchyph", "lefthyphenmin",
            "righthyphenmin", "globaldefs", "defaulthyphenchar", "defaultskewchar", "escapechar", "endlinechar", "newlinechar", "maxdeadcycles", "hangafter", "fam",
            "mag", "delimiterfactor", "showboxbreadth", "showboxdepth", "errorcontextlines", "hfuzz", "vfuzz", "overfullrule", "emergencystetch", "hsize", "vsize",
            "maxdepth", "splitmaxdepth", "boxmaxdepth", "lineskiplimit", "delimitershortfall", "nulldelimiterfall", "scriptspace", "mathsurround", "predisplaystyle",
            "displaywidth", "displayindent", "parindent", "hangindent", "hoffset", "voffset", "baselineskip", "lineskip", "parskip", "abovedisplayskip",
            "abovedisplayshortskip", "belowdisplayskip", "belowdisplayshortskip", "leftskip", "rightskip", "topskip", "splittopskip", "tabskip", "spaceskip",
            "xspaceskip", "parfillskip", "thinmuskip", "medmuskip", "thickmuskip"
        ],
        lc: {
            // Each character in TeX has a \lccode value that defines the character code of
            // the lowercase character of that character. For example, the \lccode of "A"
            // would be 0x0061 (97) because that's the charCode of "a". Most characters though
            // have their \lccode set to 0 since they don't have a lowercase character (e.g.
            // "7" or "!").
            0x41: new IntegerReg(0x61), 0x42: new IntegerReg(0x62), 0x43: new IntegerReg(0x63), 0x44: new IntegerReg(0x64), 0x45: new IntegerReg(0x65), 0x46: new IntegerReg(0x66), 0x47: new IntegerReg(0x67),
            0x48: new IntegerReg(0x68), 0x49: new IntegerReg(0x69), 0x4A: new IntegerReg(0x6A), 0x4B: new IntegerReg(0x6B), 0x4C: new IntegerReg(0x6C), 0x4D: new IntegerReg(0x6D),
            0x4E: new IntegerReg(0x6E), 0x4F: new IntegerReg(0x6F), 0x50: new IntegerReg(0x70), 0x51: new IntegerReg(0x71), 0x52: new IntegerReg(0x72), 0x53: new IntegerReg(0x73), 0x54: new IntegerReg(0x74),
            0x55: new IntegerReg(0x75), 0x56: new IntegerReg(0x76), 0x57: new IntegerReg(0x77), 0x58: new IntegerReg(0x78), 0x59: new IntegerReg(0x79), 0x5A: new IntegerReg(0x7A),
            0x61: new IntegerReg(0x61), 0x62: new IntegerReg(0x62), 0x63: new IntegerReg(0x63), 0x64: new IntegerReg(0x64), 0x65: new IntegerReg(0x65), 0x66: new IntegerReg(0x66), 0x67: new IntegerReg(0x67),
            0x68: new IntegerReg(0x68), 0x69: new IntegerReg(0x69), 0x6A: new IntegerReg(0x6A), 0x6B: new IntegerReg(0x6B), 0x6C: new IntegerReg(0x6C), 0x6D: new IntegerReg(0x6D),
            0x6E: new IntegerReg(0x6E), 0x6F: new IntegerReg(0x6F), 0x70: new IntegerReg(0x70), 0x71: new IntegerReg(0x71), 0x72: new IntegerReg(0x72), 0x73: new IntegerReg(0x73), 0x74: new IntegerReg(0x74),
            0x75: new IntegerReg(0x75), 0x76: new IntegerReg(0x76), 0x77: new IntegerReg(0x77), 0x78: new IntegerReg(0x78), 0x79: new IntegerReg(0x79), 0x7A: new IntegerReg(0x7A),
            // Greek letters also have a \lccode here since they have uppercase and lowercase
            // letters just like in a Latin alphabet.
            0x0391: new IntegerReg(0x03B1), 0x0392: new IntegerReg(0x03B2), 0x0393: new IntegerReg(0x03B3), 0x0394: new IntegerReg(0x03B4), 0x0395: new IntegerReg(0x03B5), 0x0396: new IntegerReg(0x03B6),
            0x0397: new IntegerReg(0x03B7), 0x0398: new IntegerReg(0x03B8), 0x0399: new IntegerReg(0x03B9), 0x039A: new IntegerReg(0x03BA), 0x039B: new IntegerReg(0x03BB), 0x039C: new IntegerReg(0x03BC),
            0x039D: new IntegerReg(0x03BD), 0x039E: new IntegerReg(0x03BE), 0x039F: new IntegerReg(0x03BF), 0x03A0: new IntegerReg(0x03C0), 0x03A1: new IntegerReg(0x03C1), 0x03A3: new IntegerReg(0x03C3),
            0x03A4: new IntegerReg(0x03C4), 0x03A5: new IntegerReg(0x03C5), 0x03A6: new IntegerReg(0x03C6), 0x03A7: new IntegerReg(0x03C7), 0x03A8: new IntegerReg(0x03C8), 0x03A9: new IntegerReg(0x03C9),
            0x03B1: new IntegerReg(0x03B1), 0x03B2: new IntegerReg(0x03B2), 0x03B3: new IntegerReg(0x03B3), 0x03B4: new IntegerReg(0x03B4), 0x03B5: new IntegerReg(0x03B5), 0x03B6: new IntegerReg(0x03B6),
            0x03B7: new IntegerReg(0x03B7), 0x03B8: new IntegerReg(0x03B8), 0x03B9: new IntegerReg(0x03B9), 0x03BA: new IntegerReg(0x03BA), 0x03BB: new IntegerReg(0x03BB), 0x03BC: new IntegerReg(0x03BC),
            0x03BD: new IntegerReg(0x03BD), 0x03BE: new IntegerReg(0x03BE), 0x03BF: new IntegerReg(0x03BF), 0x03C0: new IntegerReg(0x03C0), 0x03C1: new IntegerReg(0x03C1), 0x03C3: new IntegerReg(0x03C3),
            0x03C4: new IntegerReg(0x03C4), 0x03C5: new IntegerReg(0x03C5), 0x03C6: new IntegerReg(0x03C6), 0x03C7: new IntegerReg(0x03C7), 0x03C8: new IntegerReg(0x03C8), 0x03C9: new IntegerReg(0x03C9),
        },
        uc: {
            // This is the same the \lccode, except it defines the uppercase character's char-
            // acter code (used for \uccode).
            0x41: new IntegerReg(0x41), 0x42: new IntegerReg(0x42), 0x43: new IntegerReg(0x43), 0x44: new IntegerReg(0x44), 0x45: new IntegerReg(0x45), 0x46: new IntegerReg(0x46), 0x47: new IntegerReg(0x47),
            0x48: new IntegerReg(0x48), 0x49: new IntegerReg(0x49), 0x4A: new IntegerReg(0x4A), 0x4B: new IntegerReg(0x4B), 0x4C: new IntegerReg(0x4C), 0x4D: new IntegerReg(0x4D),
            0x4E: new IntegerReg(0x4E), 0x4F: new IntegerReg(0x4F), 0x50: new IntegerReg(0x50), 0x51: new IntegerReg(0x51), 0x52: new IntegerReg(0x52), 0x53: new IntegerReg(0x53), 0x54: new IntegerReg(0x54),
            0x55: new IntegerReg(0x55), 0x56: new IntegerReg(0x56), 0x57: new IntegerReg(0x57), 0x58: new IntegerReg(0x58), 0x59: new IntegerReg(0x59), 0x5A: new IntegerReg(0x5A),
            0x61: new IntegerReg(0x41), 0x62: new IntegerReg(0x42), 0x63: new IntegerReg(0x43), 0x64: new IntegerReg(0x44), 0x65: new IntegerReg(0x45), 0x66: new IntegerReg(0x46), 0x67: new IntegerReg(0x47),
            0x68: new IntegerReg(0x48), 0x69: new IntegerReg(0x49), 0x6A: new IntegerReg(0x4A), 0x6B: new IntegerReg(0x4B), 0x6C: new IntegerReg(0x4C), 0x6D: new IntegerReg(0x4D),
            0x6E: new IntegerReg(0x4E), 0x6F: new IntegerReg(0x4F), 0x70: new IntegerReg(0x50), 0x71: new IntegerReg(0x51), 0x72: new IntegerReg(0x52), 0x73: new IntegerReg(0x53), 0x74: new IntegerReg(0x54),
            0x75: new IntegerReg(0x55), 0x76: new IntegerReg(0x56), 0x77: new IntegerReg(0x57), 0x78: new IntegerReg(0x58), 0x79: new IntegerReg(0x59), 0x7A: new IntegerReg(0x5A),
            0x0391: new IntegerReg(0x0391), 0x0392: new IntegerReg(0x0392), 0x0393: new IntegerReg(0x0393), 0x0394: new IntegerReg(0x0394), 0x0395: new IntegerReg(0x0395), 0x0396: new IntegerReg(0x0396),
            0x0397: new IntegerReg(0x0397), 0x0398: new IntegerReg(0x0398), 0x0399: new IntegerReg(0x0399), 0x039A: new IntegerReg(0x039A), 0x039B: new IntegerReg(0x039B), 0x039C: new IntegerReg(0x039C),
            0x039D: new IntegerReg(0x039D), 0x039E: new IntegerReg(0x039E), 0x039F: new IntegerReg(0x039F), 0x03A0: new IntegerReg(0x03A0), 0x03A1: new IntegerReg(0x03A1), 0x03A3: new IntegerReg(0x03A3),
            0x03A4: new IntegerReg(0x03A4), 0x03A5: new IntegerReg(0x03A5), 0x03A6: new IntegerReg(0x03A6), 0x03A7: new IntegerReg(0x03A7), 0x03A8: new IntegerReg(0x03A8), 0x03A9: new IntegerReg(0x03A9),
            0x03B1: new IntegerReg(0x0391), 0x03B2: new IntegerReg(0x0392), 0x03B3: new IntegerReg(0x0393), 0x03B4: new IntegerReg(0x0394), 0x03B5: new IntegerReg(0x0395), 0x03B6: new IntegerReg(0x0396),
            0x03B7: new IntegerReg(0x0397), 0x03B8: new IntegerReg(0x0398), 0x03B9: new IntegerReg(0x0399), 0x03BA: new IntegerReg(0x039A), 0x03BB: new IntegerReg(0x039B), 0x03BC: new IntegerReg(0x039C),
            0x03BD: new IntegerReg(0x039D), 0x03BE: new IntegerReg(0x039E), 0x03BF: new IntegerReg(0x039F), 0x03C0: new IntegerReg(0x03A0), 0x03C1: new IntegerReg(0x03A1), 0x03C3: new IntegerReg(0x03A3),
            0x03C4: new IntegerReg(0x03A4), 0x03C5: new IntegerReg(0x03A5), 0x03C6: new IntegerReg(0x03A6), 0x03C7: new IntegerReg(0x03A7), 0x03C8: new IntegerReg(0x03A8), 0x03C9: new IntegerReg(0x03A9),
        }
    }
    data.mathcodes.ord = 0, data.mathcodes.op = 1, data.mathcodes.bin = 2,
    data.mathcodes.rel = 3, data.mathcodes.open = 4, data.mathcodes.close = 5,
    data.mathcodes.punct = 6, data.mathcodes.variable = 7, data.mathcodes.active = 8;

    // The definition for \crcr is exactly the same as \cr (it's just ignored in cert-
    // ain cases.
    data.defs.primitive.crcr.function = data.defs.primitive.cr.function;

    // `evalIf' is used by all \if commands. It gets a boolean argument specifying
    // whether the \if evaluated to true or false. It also gets a mouth argument to
    // take and evaluate tokens from.
    function evalIf(success, mouth, scopes, stateSymbol) {

        var tokens = [];
        if (success) {
            // The \if was evaluated to true. All the text immediately after up until the first
            // \else or \fi. If an \else is found, all the text until the first \fi is skipped.
            while (true) {
                var token = mouth.eat();

                if (!token) {
                    this.invalid = true;
                    mouth.loadState(stateSymbol);
                    return [this];
                } else if (token.type == 'command' || token.type == 'character' && token.cat == data.cats.active) {
                    // If a command was found, expand it unless it's a \else or \fi.
                    var macro = token.type == 'command' ? scopes.last.defs.primitive[token.name] || scopes.last.defs.macros[token.name] : scopes.last.defs.active[token.char];

                    if (!macro) {
                        tokens.push(token);
                        continue;
                    }

                    if ((macro === data.defs.primitive.the          || macro.proxy && macro.original === data.defs.primitive.the)          ||
                        (macro === data.defs.primitive.expandafter  || macro.proxy && macro.original === data.defs.primitive.expandafter)  ||
                        (macro === data.defs.primitive.number       || macro.proxy && macro.original === data.defs.primitive.number)       ||
                        (macro === data.defs.primitive.romannumeral || macro.proxy && macro.original === data.defs.primitive.romannumeral) ||
                        (macro === data.defs.primitive.csname       || macro.proxy && macro.original === data.defs.primitive.csname)       ||
                        (macro === data.defs.primitive.string       || macro.proxy && macro.original === data.defs.primitive.string)       ||
                        (macro === data.defs.primitive.if           || macro.isLet && macro.original === data.defs.primitive.if)           ||
                        (macro === data.defs.primitive.ifcase       || macro.isLet && macro.original === data.defs.primitive.ifcase)       ||
                        (macro === data.defs.primitive.ifcat        || macro.isLet && macro.original === data.defs.primitive.ifcat)        ||
                        (macro === data.defs.primitive.ifdim        || macro.isLet && macro.original === data.defs.primitive.ifdim)        ||
                        (macro === data.defs.primitive.ifeof        || macro.isLet && macro.original === data.defs.primitive.ifeof)        ||
                        (macro === data.defs.primitive.iffalse      || macro.isLet && macro.original === data.defs.primitive.iffalse)      ||
                        (macro === data.defs.primitive.ifodd        || macro.isLet && macro.original === data.defs.primitive.ifodd)        ||
                        (macro === data.defs.primitive.ifnum        || macro.isLet && macro.original === data.defs.primitive.ifnum)        ||
                        (macro === data.defs.primitive.ifhmode      || macro.isLet && macro.original === data.defs.primitive.ifhmode)      ||
                        (macro === data.defs.primitive.ifinner      || macro.isLet && macro.original === data.defs.primitive.ifinner)      ||
                        (macro === data.defs.primitive.ifmmode      || macro.isLet && macro.original === data.defs.primitive.ifmmode)      ||
                        (macro === data.defs.primitive.iftrue       || macro.isLet && macro.original === data.defs.primitive.iftrue)       ||
                        (macro === data.defs.primitive.ifvmode      || macro.isLet && macro.original === data.defs.primitive.ifvmode)      ||
                        (macro === data.defs.primitive.ifvoid       || macro.isLet && macro.original === data.defs.primitive.ifvoid)       ||
                        (macro === data.defs.primitive.ifx          || macro.isLet && macro.original === data.defs.primitive.ifx)) {
                        var expansion = mouth.expand(token, mouth);
                        mouth.queue.unshift.apply(mouth.queue, expansion);
                        continue;
                    } else if (macro === data.defs.primitive.else || macro.proxy && macro.original === data.defs.primitive.else) {
                        // A \else was found. Skip all the next tokens until a \fi. `skipUntil' won't eval-
                        // uate the \fi. That has to be done on the next iteration of the while loop.
                        skipUntil('fi');
                        continue;
                    } else if (macro === data.defs.primitive.fi || macro.proxy && macro.original === data.defs.primitive.fi) {
                        // A \fi was found. The \if block is done and can return the tokens now.
                        break;
                    }
                } else {
                    // The token is just a regular unexpandable token. Add it to the list. These tokens
                    // will be returned and evaluated later.
                    tokens.push(token);
                }
            }
        } else {
            // The \if was evaluated to false. All the tokens up until the first \else or \fi
            // are skipped. If there is no \else, then no tokens are expanded or returned.
            skipUntil('else');
            while (true) {
                var token = mouth.eat();

                if (!token) {
                    this.invalid = true;
                    mouth.loadState(stateSymbol);
                    return [this];
                } else if (token.type == 'command' || token.type == 'character' && token.cat == data.cats.active) {
                    var macro = token.type == 'command' ? scopes.last.defs.primitive[token.name] || scopes.last.defs.macros[token.name] : scopes.last.defs.active[token.char];
                    // There is no \else special if block here because it should have already been e-
                    // valuated. Instead, it's expanded naturally, which will mark it as invalid for
                    // being in the wrong context.
                    if ((macro === data.defs.primitive.the          || macro.proxy && macro.original === data.defs.primitive.the)          ||
                        (macro === data.defs.primitive.expandafter  || macro.proxy && macro.original === data.defs.primitive.expandafter)  ||
                        (macro === data.defs.primitive.number       || macro.proxy && macro.original === data.defs.primitive.number)       ||
                        (macro === data.defs.primitive.romannumeral || macro.proxy && macro.original === data.defs.primitive.romannumeral) ||
                        (macro === data.defs.primitive.csname       || macro.proxy && macro.original === data.defs.primitive.csname)       ||
                        (macro === data.defs.primitive.string       || macro.proxy && macro.original === data.defs.primitive.string)       ||
                        (macro === data.defs.primitive.if           || macro.isLet && macro.original === data.defs.primitive.if)           ||
                        (macro === data.defs.primitive.ifcase       || macro.isLet && macro.original === data.defs.primitive.ifcase)       ||
                        (macro === data.defs.primitive.ifcat        || macro.isLet && macro.original === data.defs.primitive.ifcat)        ||
                        (macro === data.defs.primitive.ifdim        || macro.isLet && macro.original === data.defs.primitive.ifdim)        ||
                        (macro === data.defs.primitive.ifeof        || macro.isLet && macro.original === data.defs.primitive.ifeof)        ||
                        (macro === data.defs.primitive.iffalse      || macro.isLet && macro.original === data.defs.primitive.iffalse)      ||
                        (macro === data.defs.primitive.ifodd        || macro.isLet && macro.original === data.defs.primitive.ifodd)        ||
                        (macro === data.defs.primitive.ifnum        || macro.isLet && macro.original === data.defs.primitive.ifnum)        ||
                        (macro === data.defs.primitive.ifhmode      || macro.isLet && macro.original === data.defs.primitive.ifhmode)      ||
                        (macro === data.defs.primitive.ifinner      || macro.isLet && macro.original === data.defs.primitive.ifinner)      ||
                        (macro === data.defs.primitive.ifmmode      || macro.isLet && macro.original === data.defs.primitive.ifmmode)      ||
                        (macro === data.defs.primitive.iftrue       || macro.isLet && macro.original === data.defs.primitive.iftrue)       ||
                        (macro === data.defs.primitive.ifvmode      || macro.isLet && macro.original === data.defs.primitive.ifvmode)      ||
                        (macro === data.defs.primitive.ifvoid       || macro.isLet && macro.original === data.defs.primitive.ifvoid)       ||
                        (macro === data.defs.primitive.ifx          || macro.isLet && macro.original === data.defs.primitive.ifx)) {
                        var expansion = mouth.expand(token, mouth);
                        mouth.queue.unshift.apply(mouth.queue, expansion);
                    } else if (macro && (macro === data.defs.primitive.fi || macro.proxy && macro.original === data.defs.primitive.fi)) {
                        break;
                    }
                } else {
                    tokens.push(token);
                }
            }
        }

        return tokens;

        // `skipUntil' is the function used to skip over tokens. If a \if is false, then
        // text immediately after it is skipped until either an \else of \fi (or \or if it
        // is \ifcase). This function will skip until it matches the correct token (the
        // argument `elseFi' is either "else" or "fi"). If "else" is provided, it will also
        // look for \fi since there sometimes isn't an \else. \if ... \fi nesting is taken
        // into consideration.
        function skipUntil(elseFi) {
            while (true) {
                var token = mouth.eat();

                if (!token) {
                    return;
                } else if (token.type == 'command' || token.type == 'character' && token.cat === data.cats.active) {
                    var macro = token.type == 'command' ? scopes.last.defs.primitive[token.name] || scopes.last.defs.macros[token.name] : scopes.last.defs.active[token.char];

                    if (!macro) continue;

                    // Test if the macro is a \if (or \let to be one). If it is, `skipUntil' is called
                    // recursively until a \fi is found. Then it'll return to the current level of
                    // skipping.
                    if ((macro === data.defs.primitive.if      || macro.isLet && macro.original === data.defs.primitive.if)      ||
                        (macro === data.defs.primitive.ifcase  || macro.isLet && macro.original === data.defs.primitive.ifcase)  ||
                        (macro === data.defs.primitive.ifcat   || macro.isLet && macro.original === data.defs.primitive.ifcat)   ||
                        (macro === data.defs.primitive.ifdim   || macro.isLet && macro.original === data.defs.primitive.ifdim)   ||
                        (macro === data.defs.primitive.ifeof   || macro.isLet && macro.original === data.defs.primitive.ifeof)   ||
                        (macro === data.defs.primitive.iffalse || macro.isLet && macro.original === data.defs.primitive.iffalse) ||
                        (macro === data.defs.primitive.ifodd   || macro.isLet && macro.original === data.defs.primitive.ifodd)   ||
                        (macro === data.defs.primitive.ifnum   || macro.isLet && macro.original === data.defs.primitive.ifnum)   ||
                        (macro === data.defs.primitive.ifhmode || macro.isLet && macro.original === data.defs.primitive.ifhmode) ||
                        (macro === data.defs.primitive.ifinner || macro.isLet && macro.original === data.defs.primitive.ifinner) ||
                        (macro === data.defs.primitive.ifmmode || macro.isLet && macro.original === data.defs.primitive.ifmmode) ||
                        (macro === data.defs.primitive.iftrue  || macro.isLet && macro.original === data.defs.primitive.iftrue)  ||
                        (macro === data.defs.primitive.ifvmode || macro.isLet && macro.original === data.defs.primitive.ifvmode) ||
                        (macro === data.defs.primitive.ifvoid  || macro.isLet && macro.original === data.defs.primitive.ifvoid)  ||
                        (macro === data.defs.primitive.ifx     || macro.isLet && macro.original === data.defs.primitive.ifx)) {

                        // `skipUntil' is called to look for the closing \fi.
                        skipUntil('fi');
                        // `skipUntil' does not absorb the \fi token, so it has to be eaten manually. If
                        // there was no \fi token, then there must be NO tokens left, so `mouth.eat()'
                        // won't do anything and the missing tokens will be token care of on the next loop.
                        mouth.eat();
                        continue;
                    }

                    // Now, if `elseFi' is "else", then check for a \else token. If a \else IS found,
                    // it's absorbed before returning (i.e. there's no need to revert).
                    if (elseFi == 'else' && (macro === data.defs.primitive.else || macro.isLet && macro.original === data.defs.primitive.else)) {
                        return;
                    }

                    // Now, check for \fi. It doesn't matter if `elseFi' is "else" or "fi"; both cases
                    // stop at a \fi. The \fi token shouldn't be absorbed though, so the mouth is
                    // reverted.
                    if (macro === data.defs.primitive.fi || macro.isLet && macro.original === data.defs.primitive.fi) {
                        mouth.revert();
                        return;
                    }
                }
            }
        }
    }



    // In order to initialize TeX, some definitions need to be made for macros. This is
    // where all that happens. It looks kind of ugly because all of the escaped back-
    // slashes and "\n\" line endings, but that's just how it has to look due to Java-
    // Script's string behavior. Just replace each "\\" with "\" and ignore the "\n\".
    // To hopefully make it a little easter to read, there's a comment at the end of
    // the string that's been formatted to look like real TeX (and includes TeX com-
    // ments explaining what's happening).
    fontTeX._tokenize.global('\n\
        \\def\\makeatletter{\\catcode `\\@=11\\relax}\n\
        \\def\\makeatother{\\catcode `\\@=12\\relax}\n\
        \\makeatletter\n\
        \\count10=23\n\
        \\count11=9\n\
        \\count12=9\n\
        \\count13=9\n\
        \\countdef\\insc@unt=20\n\
        \\countdef\\allocationnumber=21\n\
        \\countdef\\m@ne=22 \\m@ne=-1\n\
        \\countdef\\count@=255\n\
        \\dimendef\\dimen@=0\n\
        \\dimendef\\dimen@i=1\n\
        \\dimendef\\dimen@ii=2\n\
        \\skipdef\\skip@=0\n\
        \\def\\newcount{\\alloc@0\\count\\countdef}\n\
        \\def\\newdimen{\\alloc@1\\dimen\\dimendef}\n\
        \\def\\newskip{\\alloc@2\\skip\\skipdef}\n\
        \\def\\newmuskip{\\alloc@3\\muskip\\muskipdef}\n\
        \\def\\alloc@#1#2#3#4{\n\
          \\advance\\count1#1by1\n\
          \\allocationnumber=\\count1#1\n\
          #3#4=\\allocationnumber\n\
        }\n\
        \\newdimen\\maxdimen \\maxdimen=137438953471.99998pt\n\
        \\newskip\\hideskip \\hideskip=-1000pt plus 1fil\n\
        \\newskip\\centering \\centering=0pt plus 1000pt minus 1000pt\n\
        \\def\\newif#1{\n\
            {\\lccode`9=`i \\lccode`8=`f \\lowercase{\\gdef\\@remove@if##198##2{##2}}}\n\
            \\expandafter\\expandafter\\expandafter\n\
            \\def\\expandafter\\expandafter\\expandafter\n\
            \\@if@name\\expandafter\\expandafter\\expandafter{\\expandafter\\@remove@if\\string#1}\n\
            \\expandafter\\def\\expandafter\\@if@name@bool\\expandafter##\\expandafter1\\expandafter{\\@if@name##1}\n\
            \\expandafter\\def\\csname\\@if@name@bool{true}\\endcsname{\n\
                \\let#1=\\iftrue\n\
            }\n\
            \\expandafter\\def\\csname\\@if@name@bool{false}\\endcsname{\n\
                \\let#1=\\iffalse\n\
            }\n\
            \\let#1=\\iffalse\n\
            \\let\\@if@name=\\undefined\n\
            \\let\\@if@name@bool=\\undefined\n\
            \\let\\@remove@if=\\undefined\n\
        }\n\
        \\newcount\\active \\active=13\n\
        \\newskip\\smallskipamount \\smallskipamount=3pt plus 1pt minus 1pt\n\
        \\newskip\\medskipamount \\medskipamount=6pt plus 2pt minus 2pt\n\
        \\newskip\\bigskipamount \\bigskipamount=12pt plus 4pt minus 4pt\n\
        \\newskip\\normalbaselineskip \\normalbaselineskip=12pt\n\
        \\newskip\\normallineskip \\normallineskip=1pt\n\
        \\newdimen\\normallineskiplimit \\normallineskiplimit=0pt\n\
        \\newdimen\\jot \\jot=3pt\n\
        \\newcount\\interdisplaylinepenalty \\interdisplaylinepenalty=100\n\
        \\newcount\\interfootnotelinepenalty \\interfootnotelinepenalty=100\n\
        \\chardef\\\\="000A\n\
        \\chardef\\{=`\\{\n\
        \\chardef\\}=`\\}\n\
        \\chardef\\$=`\\$\n\
        \\chardef\\#=`\\#\n\
        \\chardef\\%=`\\%\n\
        \\chardef\\&=`\\&\n\
        \\chardef\\_=`\\_\n\
        \\chardef\\|="2016\n\
        \\chardef\\AA="00C5\n\
        \\chardef\\aa="00E5\n\
        \\chardef\\AE="00C8\n\
        \\chardef\\ae="00E6\n\
        \\chardef\\Arrowvert="2225\n\
        \\chardef\\arrowvert="23D0\n\
        \\chardef\\backslash=`\\\\\n\
        \\chardef\\bracevert="23AA\n\
        \\chardef\\dag="2020\n\
        \\chardef\\ddag="2021\n\
        \\chardef\\downarrow="2193\n\
        \\chardef\\Downarrow="21D3\n\
        \\chardef\\equiv="2261\n\
        \\chardef\\infty="221E\n\
        \\chardef\\L="0141\n\
        \\chardef\\l="0142\n\
        \\chardef\\langle="27E8\n\
        \\chardef\\lbrace=`\\{\n\
        \\chardef\\lceil="2308\n\
        \\chardef\\lfloor="230A\n\
        \\chardef\\lgroup="27EE\n\
        \\chardef\\lmoustache="23B0\n\
        \\chardef\\O="00D8\n\
        \\chardef\\o="00F8\n\
        \\chardef\\OE="0152\n\
        \\chardef\\oe="0153\n\
        \\chardef\\P="00B6\n\
        \\chardef\\rangle="27E9\n\
        \\chardef\\rbrace=`\\}\n\
        \\chardef\\rceil="2309\n\
        \\chardef\\rfloor="230B\n\
        \\chardef\\rgroup="27EF\n\
        \\chardef\\rmoustache="23B1\n\
        \\chardef\\S="00A7\n\
        \\chardef\\ss="00DF\n\
        \\chardef\\to="2192\n\
        \\chardef\\Vert="2016\n\
        \\chardef\\vert=`\\|\n\
        \\chardef\\Uparrow="21D1\n\
        \\chardef\\uparrow="2191\n\
        \\chardef\\updownarrow="2195\n\
        \\chardef\\Updownarrow="21D5\n\
        \\mathchardef\\alpha="003B1\n\
        \\mathchardef\\beta="003B2\n\
        \\mathchardef\\gamma="003B3\n\
        \\mathchardef\\delta="003B4\n\
        \\mathchardef\\epsilon="003F5\n\
        \\mathchardef\\zeta="003B6\n\
        \\mathchardef\\eta="003B7\n\
        \\mathchardef\\theta="003B8\n\
        \\mathchardef\\iota="003B9\n\
        \\mathchardef\\kappa="003BA\n\
        \\mathchardef\\lambda="003BB\n\
        \\mathchardef\\mu="003BC\n\
        \\mathchardef\\nu="003BD\n\
        \\mathchardef\\xi="003BE\n\
        \\mathchardef\\pi="003C0\n\
        \\mathchardef\\rho="003C1\n\
        \\mathchardef\\sigma="003C3\n\
        \\mathchardef\\tau="003C4\n\
        \\mathchardef\\upsilon="003C5\n\
        \\mathchardef\\phi="003D5\n\
        \\mathchardef\\chi="003C7\n\
        \\mathchardef\\psi="003C8\n\
        \\mathchardef\\omega="003C9\n\
        \\mathchardef\\varepsilon="003B5\n\
        \\mathchardef\\vartheta="003D1\n\
        \\mathchardef\\varpi="003D6\n\
        \\mathchardef\\varrho="003F1\n\
        \\mathchardef\\varsigma="003C2\n\
        \\mathchardef\\varphi="003C6\n\
        \\mathchardef\\Gamma="70393\n\
        \\mathchardef\\Delta="70394\n\
        \\mathchardef\\Theta="70398\n\
        \\mathchardef\\Lambda="7039B\n\
        \\mathchardef\\Xi="7039E\n\
        \\mathchardef\\Pi="703A0\n\
        \\mathchardef\\Sigma="703A3\n\
        \\mathchardef\\Upsilon="703A5\n\
        \\mathchardef\\Phi="703A6\n\
        \\mathchardef\\Psi="703A8\n\
        \\mathchardef\\Omega="703A9\n\
        \\mathchardef\\intop="1222B \\def\\int{\\intop\\nolimits}\n\
        \\def\\~{\\accent"007E}\n\
        \\def\\,{\\mskip\\thinmuskip}\n\
        \\def\\>{\\mskip\\medmuskip}\n\
        \\def\\;{\\mskip\\thickmuskip}\n\
        \\def\\!{\\mskip-\\thinmuskip}\n\
        \\def\\dot{\\accent"02D9 }\n\
        \\def\\ddot{\\accent"00A8 }\n\
        \\def\\lq{`}\n\
        \\def\\rq{\'}\n\
        \\def\\lbrack{[}\n\
        \\def\\rbrack{]}\n\
        \\let\\endline=\\cr\n\
        \\def\\arccos{\\mathop{\\rm arccos}\\nolimits}\n\
        \\def\\arcsin{\\mathop{\\rm arcsin}\\nolimits}\n\
        \\def\\arctan{\\mathop{\\rm arctan}\\nolimits}\n\
        \\def\\arg{\\mathop{\\rm arg}\\nolimits}\n\
        \\def\\bmod{\\nonscript\\mskip-\\medmuskip\\mkern5mu\\mathbin{\\rm mod}\\mkern5mu\\nonscript\\mskip-\\medmuskip}\n\
        \\def\\cos{\\mathop{\\rm cos}\\nolimits}\n\
        \\def\\cosh{\\mathop{\\rm cosh}\\nolimits}\n\
        \\def\\cot{\\mathop{\\rm cot}\\nolimits}\n\
        \\def\\coth{\\mathop{\\rm coth}\\nolimits}\n\
        \\def\\csc{\\mathop{\\rm csc}\\nolimits}\n\
        \\def\\deg{\\mathop{\\rm deg}\\nolimits}\n\
        \\def\\det{\\mathop{\\rm det}}\n\
        \\def\\dim{\\mathop{\\rm dim}\\nolimits}\n\
        \\def\\exp{\\mathop{\\rm exp}\\nolimits}\n\
        \\def\\gcd{\\mathop{\\rm gcd}}\n\
        \\def\\hom{\\mathop{\\rm hom}\\nolimits}\n\
        \\def\\inf{\\mathop{\\rm inf}}\n\
        \\def\\ker{\\mathop{\\rm ker}\\nolimits}\n\
        \\def\\lg{\\mathop{\\rm lg}\\nolimits}\n\
        \\def\\lim{\\mathop{\\rm lim}}\n\
        \\def\\liminf{\\mathop{\\rm lim\\,inf}}\n\
        \\def\\limsup{\\mathop{\\rm lim\\,sup}}\n\
        \\def\\ln{\\mathop{\\rm ln}\\nolimits}\n\
        \\def\\log{\\mathop{\\rm log}\\nolimits}\n\
        \\def\\max{\\mathop{\\rm max}}\n\
        \\def\\min{\\mathop{\\rm min}}\n\
        \\def\\pmod#1{\\mkern18mu({\\rm mod}\\,\\,#1)}\n\
        \\def\\Pr{\\mathop{\\rm Pr}}\n\
        \\def\\sec{\\mathop{\\rm sec}\\nolimits}\n\
        \\def\\sin{\\mathop{\\rm sin}\\nolimits}\n\
        \\def\\sinh{\\mathop{\\rm sinh}\\nolimits}\n\
        \\def\\sup{\\mathop{\\rm sup}}\n\
        \\def\\tan{\\mathop{\\rm tan}\\nolimits}\n\
        \\def\\tanh{\\mathop{\\rm tanh}\\nolimits}\n\
        \\let\\bgroup={\n\
        \\let\\egroup=}\n\
        \\def\\space{ }\n\
        \\def\\empty{}\n\
        \\def\\null{\\hbox{}}\n\
        \\def\\obeyspaces{\\catcode`\\ =\\active}\n\
        \\obeyspaces\\let =\\space\n\
        \\catcode`\\ =10\n\
        \\def\\loop#1\\repeat{\\def\\body{#1}\\iterate}\n\
        \\def\\iterate{\\body \\let\\next=\\iterate\\else\\let\\next=\\relax\\fi\\next}\n\
        \\let\\repeat=\\fi\n\
        \\def\\thinspace{\\kern.1667em}\n\
        \\def\\negthinspace{\\kern-.1667em}\n\
        \\def\\enspace{\\kern.5em}\n\
        \\def\\enskip{\\hskip.5em\\relax}\n\
        \\def\\quad{\\hskip1em\\relax}\n\
        \\def\\qquad{\\hskip2em\\relax}\n\
        \\def\\smallskip{\\vskip\\smallskipamount}\n\
        \\def\\medskip{\\vskip\\medskipamount}\n\
        \\def\\bigskip{\\vskip\\bigskipamount}\n\
        \\def~{\\char"00A0}\n\
        \\def\\strut{\\vbox to 1.2em{}}\n\
        \\newcount\\mscount\n\
        \\def\\multispan#1{\\omit \\mscount#1\\relax\\loop\\ifnum\\mscount>1\\sp@n\\repeat}\n\
        \\def\\sp@n{\\span\\omit\\advance\\mscount-1}\n\
        \\def\\two@digits#1{\\ifnum#1<10 0\\fi\\the#1}\n\
        \\def\\dospecials{\\do\\ \\do\\\\\\do\\{\\do\\}\\do\\$\\do\\&\\do\\#\\do\\^\\do\\^^K\\do\\_\\do\\^^A\\do\\%\\do\\~}\n\
        \\def\\choose{\\atopwithdelims()}\n\
        \\def\\brack{\\atopwithdelims[]}\n\
        \\def\\brace{\\atopwithdelims\\{\\}}\n\
        \\def\\mathpalette#1#2{\\mathchoice{#1\\displaystyle{#2}}{#1\\textstyle{#2}}{#1\\scriptstyle{#2}}{#1\\scriptscriptstyle{#2}}}\n\
        \\def\\frac#1#2{\\mathinner{#1\\over#2}}\n\
        \\def\\mathrm#1{{\\rm#1}}\n\
        \\def\\textrm#1{{\\rm#1}}\n\
        \\def\\mathbf#1{{\\bf#1}}\n\
        \\def\\textbf#1{{\\bf#1}}\n\
        \\def\\mathit#1{{\\it#1}}\n\
        \\def\\textit#1{{\\it#1}}\n\
        \\def\\mathsl#1{{\\sl#1}}\n\
        \\def\\textsl#1{{\\sl#1}}\n\
        \\makeatother\n\
    ', 'display');

    /*
        +-----------------------------------------------------------------+
        |                           Translation                           |
        +-----------------------------------------------------------------+
        | Treat "%" like "//"; it indicates a single line comment in TeX. |
        +-----------------------------------------------------------------+


    */

    // `fontDimen' is an object with a few functions that will get the dimensions of
    // a string rendered in a certain font. The string will have a font-size of `x'.
    // All dimensions from the font will be in terms of `x'. Each string has four dim-
    // ensions associated with it: 1) the rendered width of the string, 2) the visible
    // width of the string, 3) the visible height, and 4) the visible depth. The ren-
    // dered width is the width of string based on the font's actual width. For ex-
    // ample, the character "." has spaces on each side so that it won't be displayed
    // right up against each of its neighboring characters. In a monospace font, all
    // characters have the exact same rendered width, even though a "." and an "M" have
    // very different visible widths. The visible width is how much space is taken up
    // by the font's actual visible glyph. A space has a visible width of 0, even
    // though it has a rendered width greater than 0 that allows it to separate words.
    // The visible height dimension is the amount of space the font's glyph takes up
    // vertically above the baseline. A "y" character for example dips below the base-
    // line because it has a descender. Only the part of the glyph above the baseline
    // is counted for visible width. Visible depth is the opposite. Only the part of
    // the glyph BELOW the baseline is counted. A lot of characters have a visible
    // depth of 0 since most characters don't really dip below the baseline. Each font
    // has its own set of characters each with their own dimensions since different
    // fonts have different looks to their characters. When a character's dimensions
    // have been gotten, they are cached and stored in an object so that they can be
    // returned instantly next time. Canvases are used to measure dimensions since
    // text can be turned into a raster image that can be measured through pixels.
    fontTeX.fontDimen = {
        widthOf: function(string, family, style) {
            if (!this.isInit) this.init();

            style = ({
                undefined: '',
                nm: '',
                rm: '',
                sl: 'oblique',
                it: 'italic',
                bf: 'bold'
            })[style];

            // Return the cached value if one exists.
            if (this.cache[family] && this.cache[family][style] && this.cache[family][style][string] && !isNaN(this.cache[family][style][string].width)) return this.cache[family][style][string].width;
            // Set the font that the width will be measured in. Since the returned value is in
            // pixels, 1px is used so that the returned width will be a ratio of the charac-
            // ter's width to it height.
            this.context.font = (style || '') + ' 1px ' + family;
            this.cache[family] = this.cache[family] || {};
            this.cache[family][style] = this.cache[family][style] || {}
            this.cache[family][style][string] = this.cache[family][style][string] || {};
            return this.cache[family][style][string].width = this.context.measureText(string).width;
        },
        visibleWidthOf: function(string, family, style) {
            if (!this.isInit) this.init();

            style = ({
                undefined: '',
                nm: '',
                rm: '',
                sl: 'oblique',
                it: 'italic',
                bf: 'bold'
            })[style];

            if (this.cache[family] && this.cache[family][style] && this.cache[family][style][string] && !isNaN(this.cache[family][style][string].vWidth)) return this.cache[family][style][string].vWidth;
            // Visible width measurements work by drawing the string on the canvas first. Each
            // pixel is looked at starting from the left side and working down for each column.
            // Once a non-transparent pixel is found, that column is saved. The darkest pixel
            // from that column is saved so that it can be looked at closer (since antialiasing
            // usually prevents the character from having whole number pixel measurements). The
            // spot where the darkest pixel from the column was found is zoomed in (by redraw-
            // ing the character with a bigger font size and positioning it so that the desired
            // area is what appears in the canvas). The same thing happens again so that the
            // original measurement is more precise. This whole process happens ten times, with
            // each iteration adding more precision. The whole thing happens again in reverse
            // (to find the right boundary of the character). The difference between the two
            // measurements is returned (i.e. the width of the character).

            // A middle baseline is used so that the character will be placed in the center of
            // the canvas and (hopefully) all of it will be drawn and measured.
            this.context.textBaseline = 'middle';

            this.context.textAlign = 'center';

            function measureLeft(rectX, rectY, iteration) {
                // `rectX' and `rectY' are numbers between 0 and 1 that tell where the canvas's
                // window should be focusing on. A value of 0.5 means the center of the character
                // should be in the center of the canvas. 0.4 the canvas's window should be trans-
                // lated 10% of the canvas's width (or height depending on whether it's `rectX' or
                // `rectY') to the left (or up). On the first iteration, they are both 0.5 because
                // there isn't one part of the canvas we need to focus on yet.

                // `iteration' is the number of iterations that have already happened. Each call to
                // this function increments it by 1. Once it reaches 7, the function will return
                // whatever has been measured so far (which should be pretty precise since it'll
                // already be measuring at a 64 zoom level). `iteration' directly determines the
                // magnification level (2 ^ `iteration') so on the zeroth iteration, the zoom will
                // be 0. By the time iteration is 6 (final iteration), the zoom will be 64. The
                // iterations could theoretically keep going on forever, getting more and more pre-
                // cise each time, but in JavaScript, there's a limit. Floating point numbers only
                // get so accurate before they start to mess up calculations by losing precision.
                // That's why only 6 iterations actually happen before the function gives up and
                // returns its result.

                if (iteration == 7) return rectX;

                // Before each iteration, the previous iteration's drawings need to be cleared.
                this.context.clearRect(0, 0, 150, 150);

                var scale = Math.pow(2, iteration);

                this.context.font = (style || '') + ' ' + (100 * scale) + 'px ' + family;
                this.context.fillText(string, 75 + 150 * scale * (.5 - rectX), 75 + 150 * scale * (.5 - rectY));

                // Each pixel in each column is examined here. Since the character is rendered in
                // black, the RGB color channels don't matter; they'll always all be 0. Only the
                // alpha channel is what really determines whether the pixel is considered dark
                // or not.
                var data = this.context.getImageData(0, 0, 150, 150).data,
                    foundCol = false,
                    row = 0;
                for (var col = 0; col < 150; col++) {
                    for (var i = 0; i < 150; i++) {
                        var alpha = data[col * 4 + 150 * 4 * i + 3];

                        if (alpha > foundCol) {
                            foundCol = alpha;
                            row = i;
                        }
                    }
                    if (foundCol) break;
                }

                // If no column was found and this is the first iteration, then no pixels were
                // found (the character is just whitespace). If that's the case, a special -1 is
                // returned. After getting a -1, the outer function will return 0 overall and
                // skips over trying to measure the character from the right side.
                if (foundCol === false && iteration == 0) return -1;

                // If alpha is already above 250, it's pretty much already 100% black (not exactly
                // 100%, but pretty close). If that's the case, it probably means zooming in won't
                // solve any antialiasing issues since there's already a distinct boundary to the
                // character. Instead of keeping on with the iterations, it just ends here with the
                // current measurement.
                if (alpha > 250) return rectX + (col / 150 - .5) / Math.pow(2, iteration);

                return measureLeft.call(this, rectX + (col / 150 - .5) / Math.pow(2, iteration), rectY + (row / 150 - .5) / Math.pow(2, iteration), iteration + 1);
            }
            var leftBound = measureLeft.call(this, .5, .5, 0);
            // If -1 was returned, it means no pixels were found at all and the visible width is 0.
            if (leftBound == -1) {
                this.cache[family] = this.cache[family] || {};
                this.cache[family][style] = this.cache[family][style] || {}
                this.cache[family][style][string] = this.cache[family][style][string] || {};
                return this.cache[family][style][string].vWidth = 0;
            }

            function measureRight(rectX, rectY, iteration) {
                // This is basically the same function as above except it'll start from the right
                // and works its way left to find the right boundary of a character. There's no
                // comments here because it's the almost same thing as above.

                if (iteration == 7) return rectX;
                this.context.clearRect(0, 0, 150, 150);
                var scale = Math.pow(2, iteration);
                this.context.font = (style || '') + ' ' + (100 * scale) + 'px ' + family;
                this.context.fillText(string, 75 + 150 * scale * (.5 - rectX), 75 + 150 * scale * (.5 - rectY));
                var data = this.context.getImageData(0, 0, 150, 150).data,
                    foundCol = false,
                    row = 0;
                for (var col = 149; col >= 0; col--) {
                    for (var i = 0; i < 150; i++) {
                        var alpha = data[col * 4 + 150 * 4 * i + 3];

                        if (alpha > foundCol) {
                            foundCol = alpha;
                            row = i;
                        }
                    }
                    if (foundCol) break;
                }
                if (alpha > 250) return rectX + (col / 150 - .5) / Math.pow(2, iteration);
                return measureRight.call(this, rectX + (col / 150 - .5) / Math.pow(2, iteration), rectY + (row / 150 - .5) / Math.pow(2, iteration), iteration + 1);
            }
            var rightBound = measureRight.call(this, .5, .5, 0);

            // Now that both the left and right boundaries of a character have been found. The
            // difference between them is the visible width of the character. The numbers are
            // both percentages though of the width of the canvas (e.g. .25 and .75 mean the
            // character takes up 50% of the canvas's width). The numbers need to be in terms
            // of the character's original height (100px), not the canvas's width (150px). To
            // get there, the number is multiplied by 1.5 to get the final value. That value
            // should now be a ratio of a character's em height to its visible width in ems.
            // All that's left is to store the value in a cache (so that this whole process
            // doesn't need to be repeated each time the width is needed) and return the value.

            // I don't really know why but it seems like the number returned is always off by
            // about 0.021. It always seems to be less than the actual value no matter which
            // character it's measuring. That's why 0.021 is added to the final result. Again,
            // don't really know why but it just seems to be the case.

            this.cache[family] = this.cache[family] || {};
            this.cache[family][style] = this.cache[family][style] || {};
            this.cache[family][style][string] = this.cache[family][style][string] || {};
            return this.cache[family][style][string].vWidth = (rightBound - leftBound) * 1.5 + .021;
        },
        heightOf: function(string, family, style) {
            if (!this.isInit) this.init();

            style = ({
                undefined: '',
                nm: '',
                rm: '',
                sl: 'oblique',
                it: 'italic',
                bf: 'bold'
            })[style];

            // Visible height of a character is measured similar to how width is measured. Only
            // the part of the character above the baseline is included in the height. The part
            // below the baseline is considered the depth of the character. The sum of the
            // height and depth is the entire vertical measurement of the visible character.
            // The height of a character is used for things like accents. Accents are positioned
            // right above characters (an underscore will have a lower positioned accent than a
            // parenthesis for example).

            if (this.cache[family] && this.cache[family][style] && this.cache[family][style][string] && !isNaN(this.cache[family][style][string].height)) return this.cache[family][style][string].height;

            // An alphabetic baseline aligns text to the normal baseline. The text is set at
            // the very bottom of the canvas so that only the part above the baseline is actu-
            // ally displayed. Then the height is measured by going over each row sequentially
            // just like is done in the visible width function.
            this.context.textBaseline = 'alphabetic';

            this.context.textAlign = 'center';

            function measure(rectX, rectY, iteration) {
                // The code below is almost thee same as the code from `visibleWidth' so look there
                // for comments.

                if (iteration == 7) return rectY;
                this.context.clearRect(0, 0, 150, 150);
                var scale = Math.pow(2, iteration);
                this.context.font = (style || '') + ' ' + (100 * scale) + 'px ' + family;
                this.context.fillText(string, 75 + 150 * scale * (.5 - rectX), 75 + 150 * scale * (1 - rectY));
                var data = this.context.getImageData(0, 0, 150, 150).data,
                    foundRow = false,
                    col = 0;
                for (var row = 0; row < 150; row++) {
                    for (var i = 0; i < 150; i++) {
                        var alpha = data[row * 4 * 150 + 4 * i + 3]

                        if (alpha > foundRow) {
                            foundRow = alpha;
                            col = i;
                        }
                    }
                    if (foundRow) break;
                }
                if (foundRow === false && iteration == 0) return 1
                if (alpha > 250) return rectY + (row / 150 - .5) / Math.pow(2, iteration);
                return measure.call(this, rectX + (col / 150 - .5) / Math.pow(2, iteration), rectY + (row / 150 - .5) / Math.pow(2, iteration), iteration + 1);
            }

            this.cache[family] = this.cache[family] || {};
            this.cache[family][style] = this.cache[family][style] || {};
            this.cache[family][style][string] = this.cache[family][style][string] || {};
            return this.cache[family][style][string].height = (1 - measure.call(this, .5, .5, 0)) * 1.5;
        },
        depthOf: function(string, family, style) {
            if (!this.isInit) this.init();

            style = ({
                undefined: '',
                nm: '',
                rm: '',
                sl: 'oblique',
                it: 'italic',
                bf: 'bold'
            })[style];

            // Visible height of a character is measured similar to how width is measured. Only
            // the part of the character below the baseline is included in the depth. The part
            // above the baseline is considered the height of the character. The sum of the
            // height and depth is the entire vertical measurement of the visible character.
            // The depth of a character is used for things like underlines. Underlines are pos-
            // itioned right below the lowest character in a set. If you have the word "you"
            // underlined for example, the underline will appear below the "y" because it has
            // the lowest descender. If there was no "y" in the word, the underline would ap-
            // pear higher, under the "ou" since they're the next lowest characters.

            if (this.cache[family] && this.cache[family][style] && this.cache[family][style][string] && !isNaN(this.cache[family][style][string].depth)) return this.cache[family][style][string].depth;

            // An alphabetic baseline is used for the same reason as when the height was being
            // measured. The only difference is that the character being measured is placed at
            // the top of the canvas so that everything above the baseline is cut off.
            this.context.textBaseline = 'alphabetic';

            this.context.textAlign = 'center';

            function measure(rectX, rectY, iteration) {
                // The code below is almost thee same as the code from `visibleWidth' so look there
                // for comments.

                if (iteration == 7) return rectY;
                this.context.clearRect(0, 0, 150, 150);
                var scale = Math.pow(2, iteration);
                this.context.font = (style || '') + ' ' + (100 * scale) + 'px ' + family;
                this.context.fillText(string, 75 + 150 * scale * (.5 - rectX), 75 + 150 * scale * -rectY);
                var data = this.context.getImageData(0, 0, 150, 150).data,
                    foundRow = false,
                    col = 0;
                for (var row = 149; row >= 0; row--) {
                    for (var i = 0; i < 150; i++) {
                        var alpha = data[row * 4 * 150 + 4 * i + 3]

                        if (alpha > foundRow) {
                            foundRow = alpha;
                            col = i;
                        }
                    }
                    if (foundRow) break;
                }
                if (foundRow === false && iteration == 0) return 0
                if (alpha > 250) return rectY + (row / 150 - .5) / Math.pow(2, iteration);
                return measure.call(this, rectX + (col / 150 - .5) / Math.pow(2, iteration), rectY + (row / 150 - .5) / Math.pow(2, iteration), iteration + 1);
            }

            this.cache[family] = this.cache[family] || {};
            this.cache[family][style] = this.cache[family][style] || {};
            this.cache[family][style][string] = this.cache[family][style][string] || {};
            return this.cache[family][style][string].depth = measure.call(this, .5, .5, 0) * 1.5;
        },
        italCorrOf: function(string, family) {
            if (!this.isInit) this.init();

            // The italic correction of a character is gotten by checking how much the charac-
            // ter exceeds its boundary box (but only on the right side since that's the only
            // side that matters for italic correction).

            if (this.cache[family] && this.cache[family].italic && this.cache[family].italic[string] && !isNaN(this.cache[family].italic[string].italCorr)) return this.cache[family].italic[string].italCorr;

            // It pretty much does the same thing as visible width except the character is
            // aligned to the left side of the canvas so that only the right part of the char-
            // acter is measured. After that, the physical width is subtracted so that only the
            // width of the part of the character that exceeds the boundary box remains.
            this.context.textBaseline = 'middle';

            this.context.textAlign = 'left';

            function measure(rectX, rectY, iteration) {
                if (iteration == 7) return rectX;
                this.context.clearRect(0, 0, 150, 150);
                var scale = Math.pow(2, iteration);
                this.context.font = 'italic ' + (100 * scale) + 'px ' + family;
                this.context.fillText(string, 75 + 150 * scale * -rectX, 75 + 150 * scale * (.5 - rectY));
                var data = this.context.getImageData(0, 0, 150, 150).data,
                    foundCol = false,
                    row = 0;
                for (var col = 149; col >= 0; col--) {
                    for (var i = 0; i < 150; i++) {
                        var alpha = data[col * 4 + 150 * 4 * i + 3];
                        if (alpha > foundCol) {
                            foundCol = alpha;
                            row = i;
                        }
                    }
                    if (foundCol) break;
                }
                if (foundCol === false && iteration == 0) return 0
                if (alpha > 250) return rectX + (col / 150 - .5) / Math.pow(2, iteration);
                return measure.call(this, rectX + (col / 150 - .5) / Math.pow(2, iteration), rectY + (row / 150 - .5) / Math.pow(2, iteration), iteration + 1);
            }

            this.cache[family] = this.cache[family] || {};
            this.cache[family].italic = this.cache[family].italic || {};
            this.cache[family].italic[string] = this.cache[family].italic[string] || {};
            return this.cache[family].italic[string].italCorr = Math.max(0, measure.call(this, .5, .5, 0) * 1.5 - fontTeX.fontDimen.widthOf(string, family, 'it'));
        },
        leftOffsetOf: function(string, family, style) {
            // This measures the amount of space from the left boundary of a character to where
            // the character actually begins. For example, an "f" in the "serif" browser font
            // has a tail that sticks out to the left. This function measures that distance.
            // This is only used for when a variable character (a-z, A-Z) is being placed (to
            // give characters like "f" a bit more room like in real TeX). It doesn't complete-
            // ly mirror the way real TeX does it, but it's somewhat accurate considering this
            // has to guess at a font's characteristics just by measuring it on a canvas. If it
            // really gets something wrong, there's always kerns to move characters around man-
            // ually.

            if (!this.isInit) this.init();

            style = ({
                undefined: '',
                nm: '',
                rm: '',
                sl: 'oblique',
                it: 'italic',
                bf: 'bold'
            })[style];

            if (this.cache[family] && this.cache[family][style] && this.cache[family][style][string] && !isNaN(this.cache[family][style][string].leftOffset)) return this.cache[family][style][string].leftOffset;

            this.context.textBaseline = 'middle';

            this.context.textAlign = 'start';

            function measure(rectX, rectY, iteration) {
                if (iteration == 7) return rectX;
                this.context.clearRect(0, 0, 150, 150);
                var scale = Math.pow(2, iteration);
                this.context.font = (style || '') + ' ' + (100 * scale) + 'px ' + family;
                this.context.fillText(string, 75 + 150 * scale * (.5 - rectX), 75 + 150 * scale * (.5 - rectY));
                var data = this.context.getImageData(0, 0, 150, 150).data,
                    foundCol = false,
                    row = 0;
                for (var col = 0; col < 150; col++) {
                    for (var i = 0; i < 150; i++) {
                        var alpha = data[col * 4 + 150 * 4 * i + 3];
                        if (alpha > foundCol) {
                            foundCol = alpha;
                            row = i;
                        }
                    }
                    if (foundCol) break;
                }

                if (foundCol === false && iteration == 0) return -1;
                if (alpha > 250) return rectX + (col / 150 - .5) / Math.pow(2, iteration);
                return measure.call(this, rectX + (col / 150 - .5) / Math.pow(2, iteration), rectY + (row / 150 - .5) / Math.pow(2, iteration), iteration + 1);
            }

            this.cache[family] = this.cache[family] || {};
            this.cache[family][style] = this.cache[family][style] || {};
            this.cache[family][style][string] = this.cache[family][style][string] || {};
            return this.cache[family][style][string].leftOffset = (measure.call(this, .5, .5, 0) - .5) * -1.5;
        },
        baselineHeightOf: function(family) {
            if (!this.isInit) this.init();

            // This measures the distance from the bottom of a character's boundary box to its
            // baseline. Since the baseline is generally the same for all characters of a font,
            // the only argument this takes is the font family.

            if (this.cache[family] && !isNaN(this.cache[family].baseline)) return this.cache[family].baseline;

            this.context.textAlign = 'center';

            function measureBottom(rectX, rectY, iteration) {
                this.context.textBaseline = 'bottom';
                if (iteration == 7) return rectY;
                this.context.clearRect(0, 0, 150, 150);
                var scale = Math.pow(2, iteration);
                this.context.font = (100 * scale) + 'px ' + family;
                this.context.fillText('A', 75 + 150 * scale * (.5 - rectX), 75 + 150 * scale * (1 - rectY));
                var data = this.context.getImageData(0, 0, 150, 150).data,
                    foundRow = false,
                    col = 0;
                for (var row = 0; row < 150; row++) {
                    for (var i = 0; i < 150; i++) {
                        var alpha = data[row * 4 * 150 + 4 * i + 3]

                        if (alpha > foundRow) {
                            foundRow = alpha;
                            col = i;
                        }
                    }
                    if (foundRow) break;
                }
                if (foundRow === false && iteration == 0) return 1;
                if (alpha > 250) return rectY + (row / 150 - .5) / Math.pow(2, iteration);
                return measureBottom.call(this, rectX + (col / 150 - .5) / Math.pow(2, iteration), rectY + (row / 150 - .5) / Math.pow(2, iteration), iteration + 1);
            }

            function measureBaseline(rectX, rectY, iteration) {
                this.context.textBaseline = 'alphabetic';
                if (iteration == 7) return rectY;
                this.context.clearRect(0, 0, 150, 150);
                var scale = Math.pow(2, iteration);
                this.context.font = (100 * scale) + 'px ' + family;
                this.context.fillText('A', 75 + 150 * scale * (.5 - rectX), 75 + 150 * scale * (1 - rectY));
                var data = this.context.getImageData(0, 0, 150, 150).data,
                    foundRow = false,
                    col = 0;
                for (var row = 0; row < 150; row++) {
                    for (var i = 0; i < 150; i++) {
                        var alpha = data[row * 4 * 150 + 4 * i + 3]

                        if (alpha > foundRow) {
                            foundRow = alpha;
                            col = i;
                        }
                    }
                    if (foundRow) break;
                }
                if (foundRow === false && iteration == 0) return 1;
                if (alpha > 250) return rectY + (row / 150 - .5) / Math.pow(2, iteration);
                return measureBaseline.call(this, rectX + (col / 150 - .5) / Math.pow(2, iteration), rectY + (row / 150 - .5) / Math.pow(2, iteration), iteration + 1);
            }

            this.cache[family] = this.cache[family] || {};
            return this.cache[family].baseline = (measureBaseline.call(this, .5, .5, 0) - measureBottom.call(this, .5, .5, 0)) * 1.5;
        },
        init: function() {
            // This is where the canvas is made so that characters can be measured later. For
            // rendered width, text isn't added to the canvas, it's gotten from the canvas'
            // `measureText' method.
            this.canvas = document.createElement('canvas');
            this.canvas.style.position = 'fixed';
            this.canvas.style.top = '100vh';
            this.canvas.style.left = '100vw';
            this.canvas.style.pointerEvents = 'none';
            this.canvas.style.opacity = 0;
            this.canvas.width = 150;
            this.canvas.height = 150;
            this.context = this.canvas.getContext('2d');
            document.body.appendChild(this.canvas);
            this.isInit = true;
        },
        isInit: false,
        cache: {}
    }

    // This function is used to get the height of an element relative to its width.
    // It quickly appends `element' to `parent' (to let it inherit any styles necessary
    // to measure it), get its bounding rectangles, then removes it from `parent'.
    // Since font-size of the element will not be known yet (it may change depending on
    // the TeX used to render it), only the relative height is returned since that will
    // never change, even if the font-size does. The returned value is height/width.
    fontTeX._relHeightOf = function(element, parent) {
        // Some style are added to the element to make sure the user never notices that
        // it's being added to the DOM.
        var opacity = element.style.opacity,
            pointerEvents = element.style.pointerEvents,
            position = element.style.position;
        element.style.opacity = 0;
        element.style.pointerEvents = 'none';
        element.style.position = 'absolute';
        parent.appendChild(element);
        var rect = element.getBoundingClientRect();
        parent.removeChild(element);
        element.style.opacity = opacity;
        element.style.pointerEvents = pointerEvents;
        element.style.position = position;
        return rect.height / rect.width;
    }

    fontTeX._debug = {
        data: data
    };
}();