/**
* Copyright 2012-2018, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict';


var scatterLineAttrs = require('../../traces/scatter/attributes').line;
var dash = require('../drawing/attributes').dash;
var extendFlat = require('../../lib/extend').extendFlat;
var cartesianConstants = require('../../plots/cartesian/constants');

module.exports = {
    _isLinkedToArray: 'svcursor',

    type: {
        valType: 'enumerated',
        values: ['line'],
        dflt: 'line',
        role: 'info',
        editType: 'calcIfAutorange+arraydraw',
        description: [
            'Specifies the cursor type to be drawn.'
        ].join(' ')
    },

    cursorMode: {
        valType: 'enumerated',
        values: ['frozen', 'moveable'],
        dflt: 'moveable',
        role: 'info',
        editType: 'calcIfAutorange+arraydraw',
        description: [
            'Specifies the cursor moving mode.'
        ].join(' ')
    },

    layer: {
        valType: 'enumerated',
        values: ['above'],
        dflt: 'above',
        role: 'info',
        editType: 'arraydraw',
        description: 'Specifies whether svcursors are drawn below or above traces.'
    },

    xref: {
        valType: 'enumerated',
        values: [cartesianConstants.idRegex.x.toString()],
        dflt: 'x',
        role: 'info',
        editType: 'arraydraw',
        description: [
            'Sets the svcursor\'s x coordinate axis (for example, \'x\' or \'x2\').'
        ].join(' ')
    },

    x: {
        valType: 'any',
        role: 'info',
        editType: 'calcIfAutorange+arraydraw',
        description: [
            'Sets the svcursor\'s starting x position.',
            'See `type` for more info.'
        ].join(' ')
    },
    yref: {
        valType: 'enumerated',
        values: [cartesianConstants.idRegex.y.toString()],
        dflt: 'y',
        role: 'info',
        editType: 'arraydraw',
        description: [
            'Sets the svcursor\'s y coordinate axis (for example, \'y\' or \'y2\').'
        ].join(' ')
    },

    line: {
        color: extendFlat({}, scatterLineAttrs.color, {editType: 'arraydraw'}),
        width: extendFlat({}, scatterLineAttrs.width, {editType: 'calcIfAutorange+arraydraw'}),
        dash: extendFlat({}, dash, {editType: 'arraydraw'}),
        role: 'info',
        editType: 'calcIfAutorange+arraydraw'
    },

    editType: 'arraydraw'
};
