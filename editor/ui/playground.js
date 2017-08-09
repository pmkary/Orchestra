
//
// Copyright © 2016-present Kary Foundation, Inc. All Rights Reserved
//   Author: Pouya Kary <k@karyfoundation.org>
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//

//
// ─── FETCH MATCHES ──────────────────────────────────────────────────────────────
//

    function playgroundFetchLatestMatches ( ) {
        let matches = [ ]
        let counter = 1
        const regX = new RegExp( playgroundCompiledRegX, 'mg' )
        while ( true ) {
            const match = regX.exec( playgroundEditor.getValue( ) )
            
            if ( match === null )
                return matches

            matches.push({
                text:       match[ 0 ],
                startIndex: match.index,
                endIndex:   match[ 0 ].length + match.index,
                no:         counter++,
                groups:     match.slice( 1 )
            })
        }
    }

//
// ─── MATCH PROVIDER ─────────────────────────────────────────────────────────────
//

    function pushDecorationsToTheModel ( ) {
        if ( !playgroundEditor )
            return
        if ( playgroundCompiledRegX === '' || playgroundCompiledRegX === undefined )          return

        playgroundLatestMatches = playgroundFetchLatestMatches( )

        const decorations = playgroundLatestMatches.map( match => {
            const startPosition =
                playgroundEditor.model.getPositionAt( match.startIndex )
            const endPosition   =
                playgroundEditor.model.getPositionAt( match.endIndex )

            return {
                range: new monaco.Range(
                    startPosition.lineNumber,
                    startPosition.column,
                      endPosition.lineNumber,
                      endPosition.column
                ),
                options: {
                    className:      "match-token",
                    hoverMessage:   createHoverMessage( match ),
                }
            }
        })

        playgroundOldDecorations =
            playgroundEditor.deltaDecorations( playgroundOldDecorations , decorations )
    }

//
// ─── REMOVE DECORATIONS ─────────────────────────────────────────────────────────
//

    function removeDecorationsFromPlayground ( ) {
        playgroundOldDecorations =
            playgroundEditor.deltaDecorations( playgroundOldDecorations, [{
                range: new monaco.Range( 1, 1, 1, 1 ),
                options : { }
            }])
    }

//
// ─── CREATING HOVER MESSAGE ─────────────────────────────────────────────────────
//

    function createHoverMessage ( match ) {
        let groupCounter = 1
        const groups = match.groups.map( group => {
            let groupValue
            if ( group === undefined )
                groupValue = '_Empty_' 
            else
                groupValue = "`" + group + "`"

            return `Group #${ groupCounter++ }: ${ groupValue }`
        })

        return(
            `__Match No. ${ match.no }__\n\n` +
            `Range: ${ match.startIndex } &mdash; ${ match.endIndex - 1 }\n\n` +
            `*****\n\n` +
            `\`\`\`\n${ match.text }\n\`\`\`\n\n` +
            (( groupCounter === 1 )? '' : '\n\n*****\n\n' ) +
            groups.join('\n\n')
        )
    }

//
// ─── INIT MONACO EDITOR ─────────────────────────────────────────────────────────
//

    function initMonacoEditor ( ) {
        // constants
        playgroundCompiledRegX = fetchLatestCompiledRegExp( )
        playgroundFontSize = 14
        playgroundOldDecorations = [ ]

        let lastValue = ''
        if ( playgroundEditor !== null && playgroundEditor !== undefined ) {
            lastValue = playgroundEditor.getValue( )
            playgroundEditor = undefined
            document.getElementById(playgroundEditorID).innerHTML = ''
        }

        function uriFromPath ( _path ) {
            const pathName = path.resolve( _path ).replace( /\\/g, '/' )
            if ( pathName.length > 0 && pathName.charAt( 0 ) !== '/' )
                pathName = '/' + pathName
            return encodeURI( 'file://' + pathName )
        }

        require.config({
            baseUrl: uriFromPath(
                path.join( __dirname, 'node_modules', 'monaco-editor', 'min' ))
        })

        // workaround monaco-css not understanding the environment
        self.module = undefined

        // workaround monaco-typescript not understanding the environment
        self.process.browser = true

        require([ 'vs/editor/editor.main' ], function ( ) {

            const MatchLanguageName = 'CurrentMatchLanguage'
            monaco.languages.register({ id: MatchLanguageName })

            playgroundEditor = monaco.editor.create(
                document.getElementById( playgroundEditorID ), {
                    value: lastValue,
                    language: MatchLanguageName,
                    fontFamily: 'GraphSourceCodePro',
                    fontSize: playgroundFontSize,
                    lineHeight: getPlaygroundLineHeight( ),
                    suggestOnTriggerCharacters: false,
                    renderWhitespace: true,
                    insertSpaces: false,
                    mouseWheelZoom: false,
                    quickSuggestions: false,
                    minimap: true,
                    theme: ( WindowTheme === 'dark' )? 'vs-dark' : 'vs'
                }
            )

            // decoration handlers
            setupPlaygroundChangeContentEvent( )
            pushDecorationsToTheModel( )
        })
    }

//
// ─── ON CHANGE EVENTS ───────────────────────────────────────────────────────────
//

    function setupPlaygroundChangeContentEvent ( ) {
        const delay = null;
        clearTimeout( playgroundDecorationDelayerTimeout )

        function onChangeContent ( ) {
            removeDecorationsFromPlayground( )
            pushDecorationsToTheModel( )
        }

        playgroundEditor.getModel( ).onDidChangeContent( e => {
            clearTimeout( playgroundDecorationDelayerTimeout )
            removeDecorationsFromPlayground( )
            playgroundDecorationDelayerTimeout =
                setTimeout( onChangeContent, delay )
        })
    }

//
// ─── OPEN FILE ON PLAYGROUND ────────────────────────────────────────────────────
//

    function onOpenFileOnPlayground ( ) {
        // get file path
        let filePath = dialog.showOpenDialog( getWindowForDialogSheets( ), {
            properties: [ 'openFile' ]
        })

        if ( filePath === undefined || filePath.length === 0 ) return;

        fs.readFile( filePath[ 0 ].toString( ) , ( err, fileData ) => {
            if ( err === true ) {
                return;
            }
            playgroundEditor.setValue( fileData.toString( ) )
        })
    }

//
// ─── ON RUN TEST DRIVE ──────────────────────────────────────────────────────────
//

    function onPerformTestDrive ( ) {
        onChangeWindowToPlayground( )
    }

//
// ─── SET PLAYGROUND COLOR ───────────────────────────────────────────────────────
//

    function changePlaygroundThemeTo ( mode ) {
        if ( playgroundEditor )
            playgroundEditor.updateOptions({
                'theme': ( mode === 'dark' )? 'vs-dark' : 'vs'
            })
    }

//
// ─── MAKE FONT SIZE BIGGER ──────────────────────────────────────────────────────
//

    function playgroundMakeFontSizeBigger ( ) {
        playgroundFontSize++
        updatePlaygroundFontSize( )
    }

    function playgroundMakeFontSizeSmaller ( ) {
        playgroundFontSize--
        updatePlaygroundFontSize( )
    }

    function updatePlaygroundFontSize ( ) {
        if ( playgroundEditor )
            playgroundEditor.updateOptions({
                fontSize: playgroundFontSize,
                lineHeight: getPlaygroundLineHeight( )
            })
    }

//
// ─── GET LINE HEIGHT BASED ON FONT SIZE ─────────────────────────────────────────
//

    function getPlaygroundLineHeight ( ) {
        return Math.floor( playgroundFontSize * 1.8 )
    }

// ────────────────────────────────────────────────────────────────────────────────