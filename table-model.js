TableModel = (function($) {
    var TableModel = function($table, options = {}) {
        this.getTable = function() {
            return $table;    
        };
        $.extend(this.options, options);
        this.options.wireTableEvents.call(this);
        $table.data("table-model", this);
    };

    var addListener = function(type, handler) {
        this[type + "Listeners"].push(handler);
    };

    var callListeners = function(type, arguments) {
        // console.log("calling " + type + " listeners");
        var listeners = this[type + "Listeners"];
        for (var index in listeners) {
            listeners[index].apply(null, arguments);
        }
    };

    var getRows = function($table) {
        if ($table.has("thead, tbody")) {
            var trs = $table.children("thead").children("tr");
            trs = trs.add($table.children("tbody").children("tr"));
            trs = trs.add($table.children("tfoot").children("tr"));
            return trs;
        } else {
            return $table.children("tr");
        }    
    };

    var staticWireTableEvents = function() {
        var $table = this.getTable();
        var tableModel = this;

        var rows = getRows($table);
        rows.each(function(rowIndex) {
            var $row = $(this);
            $row.addClass("row-" + rowIndex);
            $row.children("td, th").each(function(columnIndex) {
                var $cell = $(this);
                $cell.addClass("column-" + columnIndex);
                $cell.data("row", rowIndex);
                $cell.data("column", columnIndex);
            })
        });

        $table.on("change", "td input, td textarea", function() {
            var $cell = $(this);
            var row = $cell.data("row");
            var column = $cell.data("column");
            onCellValueChange.call(tableModel, row, column);
        });
    };

    var staticFindCell = function(row, column) {
        return this.getTable().find(".row-" + row).find(".column-" + column);
    };
    
    var defaultReadCellValue = function(cell) {
        if (cell.has("input").length) {
            return cell.children("input").val();
        } else if (cell.has("textarea").length) {
            return cell.children("textarea").text();
        } else {
            return cell.text();
        }
    };   

    var defaultSetCellValue = function(cell, value) {
        if (cell.has("input").length) {
            cell.children("input").val(value);
        } else if (cell.has("textarea").length) {
            cell.children("textarea").text(value);
        } else {
            cell.text(value);
        }        
    };

    var onCellValueChange = function(row, column) {
        callListeners.call(this, "cell", [row, column]);
        callListeners.call(this, "row", [row]);
        callListeners.call(this, "column", [column]);
    };

    var defaultOptions = {
        findCell : staticFindCell,

        wireTableEvents : staticWireTableEvents,

        readCellValue : defaultReadCellValue,

        setCellValue : defaultSetCellValue
    };

    TableModel.prototype = {
        options : defaultOptions,
        
        cellListeners : [],

        rowListeners : [],

        columnListeners : [],

        get : function(row, column) {
            var cell = this.options.findCell.call(this, row, column);
            return this.options.readCellValue.call(this, cell);
        },

        set : function(row, column, value) {
            var cell = this.options.findCell.call(this, row, column);
            var originalValue = this.options.readCellValue.call(this, cell);

            // console.log("setting " + row + ", " + column + ":" + value);

            if (value !== originalValue) {
                this.options.setCellValue.call(this, cell, value);
                onCellValueChange.call(this, row, column);
                return true;
            } else {
                return false;
            }
        },

        onCellChange : function(listener) {
            addListener.call(this, "cell", listener);
        },

        onColumnChange : function(listener) {
            addListener.call(this, "column", listener);
        },

        onRowChange : function(listener) {
            addListener.call(this, "row", listener);
        },

        bind : function(sourceIndices, targetIndex, handler, applyImmediately = false) {
            var tableModel = this;

            var applyHandler = function() {
                var args = [];
                for (var index in sourceIndices) {
                    var pair = sourceIndices[index];
                    args.push(tableModel.get(pair[0], pair[1]));
                }
                var value = handler.call(null, args);
                tableModel.set(targetIndex[0], targetIndex[1], value);
            };

            tableModel.onCellChange(function(row, column) {
                for (var index in sourceIndices) {
                    var pair = sourceIndices[index];
                    if (pair[0] == row && pair[1] == column) {
                        applyHandler();
                        break;
                    }
                }
            });

            if (applyImmediately) {
                applyHandler();
            }
        }
    };

    $.extend(TableModel, {
        bindingMethods : {
            sum : function(args) {
                var result = 0;
                $.each(args, function(index, arg) {   
                    result = result + parseFloat(arg);
                });
                return result;
            },

            product : function(args) {
                var result = 1;
                $.each(args, function(index, arg) { 
                    result = result * parseFloat(arg);
                });
                return result;
            }
        }
    });

    return TableModel;
})(jQuery);