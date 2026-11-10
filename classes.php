<?php
// =====================================================================
// The 4 data structures / algorithms of the project, written by hand.
// (No built-in sort(), usort(), array_search() etc. is used here.)
// =====================================================================


// ---------------------------------------------------------------------
// 1. HASH TABLE  -  finds a product by its code very fast  (O(1) average)
// ---------------------------------------------------------------------
// Idea: the product code is turned into a number (the "index").
// The product is kept in the box (bucket) with that number.
// To find it again, we compute the same number and open only that box.
class HashTable {
    private $buckets = [];     // list of boxes
    private $size = 50;        // number of boxes

    function __construct() {
        for ($i = 0; $i < $this->size; $i++) {
            $this->buckets[$i] = [];
        }
    }

    // Hash function: add up the character codes, then take the remainder
    private function getIndex($key) {
        $total = 0;
        for ($i = 0; $i < strlen($key); $i++) {
            $total = $total + ord($key[$i]);
        }
        return $total % $this->size;
    }

    // Save a product. If two codes land in the same box (collision),
    // they are simply stored one after the other in that box (chaining).
    function put($key, $value) {
        $index = $this->getIndex($key);
        for ($i = 0; $i < count($this->buckets[$index]); $i++) {
            if ($this->buckets[$index][$i]['key'] === $key) {
                $this->buckets[$index][$i]['value'] = $value;   // already exists: replace
                return;
            }
        }
        $this->buckets[$index][] = ['key' => $key, 'value' => $value];
    }

    // Get a product by code. Returns null if not found.
    function get($key) {
        $index = $this->getIndex($key);
        for ($i = 0; $i < count($this->buckets[$index]); $i++) {
            if ($this->buckets[$index][$i]['key'] === $key) {
                return $this->buckets[$index][$i]['value'];
            }
        }
        return null;
    }

    function has($key) {
        return $this->get($key) !== null;
    }
}


// ---------------------------------------------------------------------
// 2. MERGE SORT  -  sorts the list by name, code, quantity or price  (O(n log n))
// ---------------------------------------------------------------------
// Idea: cut the list in half again and again until each piece has 1 item,
// then merge the pieces back together in the correct order.

// Compare two values. Numbers are compared as numbers, text ignores upper/lower case.
// Returns a negative number if $a comes first, positive if $b comes first, 0 if equal.
function compareValues($a, $b) {
    if (is_numeric($a) && is_numeric($b)) {
        return $a <=> $b;
    }
    return strcmp(strtolower($a), strtolower($b));
}

function mergeSort($list, $field, $ascending = true) {
    if (count($list) <= 1) {
        return $list;                                    // 0 or 1 item is already sorted
    }
    $middle = intdiv(count($list), 2);
    $left  = mergeSort(array_slice($list, 0, $middle), $field, $ascending);   // sort left half
    $right = mergeSort(array_slice($list, $middle), $field, $ascending);      // sort right half
    return mergeLists($left, $right, $field, $ascending);
}

// Merge two already-sorted lists into one sorted list
function mergeLists($left, $right, $field, $ascending) {
    $result = [];
    $i = 0;    // position in left list
    $j = 0;    // position in right list

    while ($i < count($left) && $j < count($right)) {
        $difference = compareValues($left[$i][$field], $right[$j][$field]);
        // "<=" / ">=" takes the LEFT item when equal, so equal items keep their order (stable)
        if ($ascending) { $takeLeft = ($difference <= 0); }
        else            { $takeLeft = ($difference >= 0); }

        if ($takeLeft) { $result[] = $left[$i];  $i++; }
        else           { $result[] = $right[$j]; $j++; }
    }
    while ($i < count($left))  { $result[] = $left[$i];  $i++; }   // leftovers
    while ($j < count($right)) { $result[] = $right[$j]; $j++; }
    return $result;
}


// ---------------------------------------------------------------------
// 3. BINARY SEARCH  -  finds products by name in a name-sorted list  (O(log n))
// ---------------------------------------------------------------------
// Idea: look at the middle item. If our text comes before it, throw away the
// right half. If after, throw away the left half. Repeat until found.
// The list MUST already be sorted by name (we use mergeSort for that).
function binarySearchName($sortedList, $text) {
    $text = strtolower(trim($text));
    $low = 0;
    $high = count($sortedList) - 1;
    $firstMatch = -1;

    while ($low <= $high) {
        $middle = intdiv($low + $high, 2);
        $name = strtolower($sortedList[$middle]['name']);

        if (strncmp($name, $text, strlen($text)) === 0) {   // name starts with the text
            $firstMatch = $middle;
            $high = $middle - 1;                            // keep looking left for an earlier match
        } elseif (strcmp($name, $text) < 0) {
            $low = $middle + 1;                             // text is after middle -> go right
        } else {
            $high = $middle - 1;                            // text is before middle -> go left
        }
    }

    // Collect the first match and every match right after it
    $found = [];
    if ($firstMatch == -1) {
        return $found;
    }
    for ($i = $firstMatch; $i < count($sortedList); $i++) {
        $name = strtolower($sortedList[$i]['name']);
        if (strncmp($name, $text, strlen($text)) !== 0) {
            break;
        }
        $found[] = $sortedList[$i];
    }
    return $found;
}


// ---------------------------------------------------------------------
// 4. STACK (LIFO)  -  remembers transactions so the last one can be undone  (O(1))
// ---------------------------------------------------------------------
// Last In, First Out: like a pile of plates - you always take the top one.
// The pile is kept in the session, so it is empty again after each new login.
class UndoStack {
    static function push($transaction) {      // put on top
        $_SESSION['undo'][] = $transaction;
    }
    static function pop() {                   // take from top (null if empty)
        if (empty($_SESSION['undo'])) {
            return null;
        }
        return array_pop($_SESSION['undo']);
    }
    // Remove every saved transaction of one product (used when a product is deleted)
    static function removeCode($code) {
        $kept = [];
        foreach ($_SESSION['undo'] ?? [] as $item) {
            if ($item['code'] !== $code) {
                $kept[] = $item;
            }
        }
        $_SESSION['undo'] = $kept;
    }
    static function size() {
        return count($_SESSION['undo'] ?? []);
    }
}
