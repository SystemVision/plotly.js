/**
* Copyright 2012-2018, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/


'use strict';

var axisIds = require('../../plots/cartesian/axis_ids');

var Registry = require('../../registry');

module.exports = {
    add: addSVCursor,
    delete: delSVCursor
};

/**
 * SVCursors wrapper around 'add' and 'delete'.
 *
 * @param {object} gd main plot object
 *
 */

function addSVCursor(gd) {
    // Get only "x" axes
    var axList = axisIds.list(gd, 'x', true);

    var rangeNow = [0, 1];

    var layoutUpdate = {};

    layoutUpdate.svcursors = gd._fullLayout.svcursors;

    var xVal = 0;

    for(var i = 0; i < axList.length; i++) {
        var ax = axList[i];
        // This is visible range
        rangeNow = [
            ax.r2l(ax.range[0]),
            ax.r2l(ax.range[1]),
        ];
        xVal = (rangeNow[0] + rangeNow[1]) / 2.0;

        if(ax.type === 'date' && ax.calendar) {
            xVal = ax.c2d(xVal, 0, ax.calendar);
        }

        layoutUpdate.svcursors.push(

            {
                x: xVal,
                xref: ax._id
            });
    }

    Registry.call('relayout', gd, layoutUpdate);
}

function delSVCursor(gd) {
    var layoutUpdate = {
        svcursors: []
    };
    var arr = gd._fullLayout.svcursors;
    if(arr.length) {
        arr.pop();
        if(arr.length) {
            layoutUpdate.svcursors = arr;
        }
    }

    Registry.call('relayout', gd, layoutUpdate);
}
