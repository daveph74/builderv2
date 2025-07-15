<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('editor');
});

Route::get('/editor', function () {
    return view('editor');
});

Route::get('/editor/{id}', function ($id) {
    return view('editor', ['templateId' => $id]);
})->where('id', '[0-9]+');
