Table model for jQuery
======================
See test.html to see how this library can be used.

How to create
-------------
As jQuery plugin:

* $("table#id").tableModel();

As standalone constructor:

* var model = new TableModel($("table#id"));

How to bind expressions
-----------------------
* model.set(row, column, expression);
* model.listen(expression, function(value) {...});

Options
-------
* precision - number of digits after decimal point (default: undefined)
* recalculateOnType - if true, recalculation occurs instantenously, on "input" event (default: false)
* cachingEnabled - if true, an array of table values is kept as data model, otherwise, the values are always read from the cells (default: true)

Advanced options (see code):

* valueParser
* setCellValue
* readCellValue
* findCell
* wireTableEvents

Cell modifiers
--------------
Obtained as cell.data("...")
* precision - number of digits after decimal point
* value - value that is used in expressions (until set to another value)

Selections
----------
Available from namespaces TableModel.select or TableModel.s

* cell(row, column) - zero-based coordinates of the table
* range(row1, column1, row2, column2) - inclusive zero-based coordinates
* combine(selection1, ...)

Expressions
-----------
Available from namespaces TableModel.expression or TableModel.e

* sum(arg1, arg2, arg3, ...) - arguments can be numbers, expressions, selections
* product(arg1, arg2, arg3, ...) - arguments can be numbers, expressions, selections
* countIf(selection, condition)

Value parsers
-------------
The table model uses a generalized concept of a parser when reading values
from cells (either static or editable). The default one just uses javascript
default value treatment but you can provide your own by setting the
"valueParser" option of the model. Available from TableModel.valueParsers:

* default - does nothing :-)
* commaAsDot - Treats all commas as dots (useful in countries where comma is used for separating integer and fractional parts of numbers)
* chain - A combination of two parsers.
