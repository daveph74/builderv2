<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class ImageUploadController extends Controller
{
    /**
     * Upload an image to S3 organized by client_id
     */
    public function upload(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'image' => 'required|file|mimes:jpeg,png,jpg,gif,webp,svg|max:10240', // 10MB max, includes SVG
            'client_id' => 'required|exists:clients,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $image = $request->file('image');
            $clientId = $request->input('client_id');

            // Generate unique filename
            $extension = $image->getClientOriginalExtension();
            $filename = Str::uuid() . '.' . $extension;

            // Create the S3 path: client_id/images/filename
            $s3Path = "client_{$clientId}/images/{$filename}";

            // Upload to S3
            $disk = Storage::disk('s3');
            $path = $disk->putFileAs(
                dirname($s3Path),
                $image,
                basename($s3Path),
                'public'
            );

            if (!$path) {
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to upload file to S3'
                ], 500);
            }

            // Get the public URL
            $url = $disk->url($path);

            return response()->json([
                'success' => true,
                'message' => 'Image uploaded successfully',
                'data' => [
                    'filename' => $filename,
                    'path' => $path,
                    'url' => $url,
                    'client_id' => $clientId,
                    'size' => $image->getSize(),
                    'mime_type' => $image->getMimeType(),
                    'original_name' => $image->getClientOriginalName()
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Upload failed: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * List images for a specific client
     */
    public function listByClient(Request $request, $clientId): JsonResponse
    {
        $validator = Validator::make(['client_id' => $clientId], [
            'client_id' => 'required|exists:clients,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid client ID',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $disk = Storage::disk('s3');
            $clientPath = "client_{$clientId}/images/";

            $files = $disk->files($clientPath);

            $images = [];
            foreach ($files as $file) {
                $images[] = [
                    'path' => $file,
                    'url' => $disk->url($file),
                    'filename' => basename($file),
                    'size' => $disk->size($file),
                    'last_modified' => $disk->lastModified($file)
                ];
            }

            return response()->json([
                'success' => true,
                'data' => $images
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to list images: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete an image from S3
     */
    public function delete(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'path' => 'required|string',
            'client_id' => 'required|exists:clients,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $path = $request->input('path');
            $clientId = $request->input('client_id');

            // Verify the path belongs to the client
            $expectedPrefix = "client_{$clientId}/images/";
            if (!str_starts_with($path, $expectedPrefix)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized access to file'
                ], 403);
            }

            $disk = Storage::disk('s3');

            if (!$disk->exists($path)) {
                return response()->json([
                    'success' => false,
                    'message' => 'File not found'
                ], 404);
            }

            $disk->delete($path);

            return response()->json([
                'success' => true,
                'message' => 'Image deleted successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Delete failed: ' . $e->getMessage()
            ], 500);
        }
    }
}
