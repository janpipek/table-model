Table model for jQuery
======================
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
* precision - number of digits after decimal point
* recalculateOnType - if true, recalculation occurs instantenously ("input" event)

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
