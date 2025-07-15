<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\TemplateController;
use App\Http\Controllers\ClientController;
use App\Http\Controllers\ImageUploadController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

Route::apiResource('templates', TemplateController::class);
Route::apiResource('clients', ClientController::class);

// Image upload routes
Route::post('/images/upload', [ImageUploadController::class, 'upload']);
Route::get('/images/client/{clientId}', [ImageUploadController::class, 'listByClient']);
Route::delete('/images', [ImageUploadController::class, 'delete']);

Route::get('/config', [TemplateController::class, 'config']);

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');
