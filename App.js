
Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',

    items: [{
        xtype: 'container',
        itemId: 'content'
    }],

    launch: function () {

        Ext.create('Rally.data.WsapiDataStore', {
            model: 'Changeset',
            key: 'changeset',
            type: 'changeset',
            autoLoad: true,
            fetch: ['Changes', 'SCMRepository', 'Revision', 'SCMType', 'Message', 'Action', 'Uri', 'PathAndFilename', 'Author', 'Name', 'Artifacts', 'FormattedID'],
            sorters: [{
                property: 'CreationDate',
                direction: 'DESC'
            }],
            pageSize: 20,
            listeners: {
                load: this._onChangeSetDataLoaded,
                scope: this
            }
        });

    },

    //private method for replacing all instances of targetStr in txt with replacementStr
    _replace: function (txt, targetStr, replacementStr) {
        var currentStr, newTxt;
        var i,
            ln = targetStr.length,
            newTxtPause;
        for (i = 0; i < txt.length - ln + 1; i++) {
            currentStr = txt.slice(i, i + ln);
            if (currentStr === targetStr) {
                if (newTxt === undefined) {
                    newTxt = txt.slice(0, i);
                    newTxt += replacementStr;
                    i += ln - 1;
                    newTxtPause = i + 1;
                } else {
                    newTxt += txt.slice(newTxtPause, i);
                    newTxt += replacementStr;
                    i += ln - 1;
                    newTxtPause = i + 1;
                }
            }
        }
        if (newTxt === undefined) {
            newTxt = txt;
        } else {
            newTxt += txt.slice(newTxtPause, txt.length);
        }

        return newTxt;
    },

    //eliminates multiple spaces, leading spaces, and trailing spaces from a string
    _reduceSpaces: function (str) {
        var splitArray = str.split(' '),
            cnt;
        var compactStr = '';
        for (cnt = 0; cnt < splitArray.length; cnt++) {
            if (splitArray[cnt] !== '') {
                compactStr += splitArray[cnt];
                compactStr += ' ';
            }
        }
        compactStr = compactStr.replace(/\s$/, '');
        return compactStr;
    },

    //private method to re-format changeset message so the Rally artifact links to its detail page
    _formatMessage: function (message, artifact) {
        var formattedMsg = message;
        var rallyId = artifact.FormattedID.toLowerCase();

        var matchStr = message.toLowerCase().match(rallyId);

        if (matchStr !== null) {
            formattedMsg = message.slice(0, matchStr.index);
            formattedMsg += '<a href=' + Rally.util.Navigation.createRallyDetailUrl(artifact._ref, false) + ' target="_blank">' + message.slice(matchStr.index, matchStr.index + rallyId.length) + '</a>';
            formattedMsg += message.slice(matchStr.index + rallyId.length);
        }
        return formattedMsg;
    },

    _buildHTML: function (record) {
        var compactMessage = record.get('Message'),
            changes = record.get('Changes'),
			forComparison;
        var i, j,
            actionAndPath,
            breakNext = false,
            match_Index, lastMatch_Index;
        var messageLength = compactMessage.length,
            numChangedFiles = changes.length;
        var changedFiles = numChangedFiles > 0;
        var text;
        var easterEgg = false;
        text = record.get('SCMRepository').Name + " " + record.get('SCMRepository').SCMType + ' Check-in <div style=padding-left:7px;>';
        text += record.get('Author') !== null ? 'Author: ' + record.get('Author')._refObjectName + '<br />' : '';
        text += record.get('Revision') !== null ? 'Revision: ' + record.get('Revision') + '<br />' : '';
        //As the files changed in the revision are often listed in the message, compactMessage is used in place of record.get('Message') to avoid redundancy.
        //compactMessage is a version of record.get('Message') with all the names of the files changed during the revision removed.
        if (changedFiles) {
			
            for (i = 0; i < numChangedFiles; i++) {
                compactMessage = this._replace(compactMessage, record.get('Changes')[i].Action + ' ' + record.get('Changes')[i].PathAndFilename, '');
            }
            //the maximum allowable length of record.get('Message') is 3999. If the message has hit this limit because of its concatenation with the files changed,  
            //the list of files changed will likely have been cut-off, and additional screening will be required to remove the excess cut-off file path names.
            if (messageLength === 3999) {
				forComparison = compactMessage;
                easterEgg = true;
                for (j = 0; j < numChangedFiles; j++) {
                    actionAndPath = changes[j].Action + ' ' + changes[j].PathAndFilename;
                    for (i = actionAndPath.length - 1; i > 0; i--) {
                        forComparison = compactMessage.replace(actionAndPath.slice(0, i), '');
                        //looks for parts of "change.Action + ' ' + change.PathAndFilename" in compactMessage.
                        //will only record a hit if it's at the very end of compactMessage.
                        if (forComparison === compactMessage.slice(0, compactMessage.length - i)) {
							compactMessage = forComparison;
                            breakNext = true;
                            break;
                        }
                    }
                    if (breakNext) break;
                }
            }
        }
        compactMessage = this._reduceSpaces(compactMessage);
        if (easterEgg) compactMessage += '<a ondblclick="easterEgg()">.</a>';
        text += record.get('Revision') !== null ? 'Message: ' + this._formatMessage(compactMessage, record.get('Artifacts')[0]) + '<br /><br />' : 'Message: ' + compactMessage + '<br /><br />';

        if (changedFiles) {
            text += 'Files Affected By Revision ' + record.get('Revision') + '<br />';

            for (i = 0; i < numChangedFiles; i++) {
                text += record.get('Changes')[i].Action + ' <a href=' + record.get('Changes')[i].Uri + ' target="_blank">' + record.get('Changes')[i].PathAndFilename + '</a><br />';
            }
        } else {
            text += 'No affected files';
        }

        return '<div class="changeset">' + text + '</div></div>';
    },

    _checkToBuildHTML: function (record) {
        if (!record.get('SCMRepository')) {
            return  '<div class="no_data">No source code check-ins.<br>' + 'There are either no check-in discussion post/changeset data or no Rally source ' +
                    'code management connector has been installed. ' + 'To get started, see the <a href=http://www.rallydev.com/help/source-code target="_blank">' + 
                    'available</a> Rally source code management connectors.';
        }
        return this._buildHTML(record);
    },

    _onChangeSetDataLoaded: function (store, data) {
        var newEntry, that = this;
        Ext.Array.each(data, function (record) {
            newEntry = Ext.create('Ext.container.Container', {
                html: that._checkToBuildHTML(record),
                style: {
                    margin: '5px',
                    borderTop: '2px solid #085478'
                }
            });
            that.down('#content').add(newEntry);
        });
    }
});