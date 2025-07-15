<?php

namespace App\Http\Controllers;

use App\Models\Template;
use App\Models\TemplateItem;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class TemplateController extends Controller
{
    /**
     * Display a listing of templates.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Template::with(['items', 'client']);

        if ($request->has('search')) {
            $search = $request->get('search');
            $query->where('name', 'like', '%' . $search . '%');
        }

        $templates = $query->withCount('items as elements_count')
            ->orderBy('updated_at', 'desc')
            ->get();

        return response()->json($templates);
    }

    /**
     * Store a newly created template.
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255|unique:templates,name',
            'width' => 'required|integer|min:1',
            'height' => 'required|integer|min:1',
            'client_id' => 'required|exists:clients,id',
            'elements' => 'required|array',
            'elements.*.name' => 'required|string',
            'elements.*.type' => 'required|string',
            'elements.*.x' => 'required|integer',
            'elements.*.y' => 'required|integer',
            'elements.*.width' => 'required|integer',
            'elements.*.height' => 'required|integer',
        ]);

        $template = Template::create([
            'name' => $request->name,
            'width' => $request->width,
            'height' => $request->height,
            'client_id' => $request->client_id,
            'layer_order' => $request->input('layerOrder', []),
            'layer_visibility' => $request->input('layerVisibility', []),
        ]);

        foreach ($request->elements as $elementData) {
            $template->items()->create([
                'name' => $elementData['name'],
                'type' => $elementData['type'],
                'x' => $elementData['x'],
                'y' => $elementData['y'],
                'width' => $elementData['width'],
                'height' => $elementData['height'],
                'text' => $elementData['text'] ?? null,
                'fontSize' => $elementData['fontSize'] ?? 14,
                'fontFamily' => $elementData['fontFamily'] ?? 'Arial',
                'textAlign' => $elementData['textAlign'] ?? 'left',
                'lineHeight' => $elementData['lineHeight'] ?? 18,
                'color' => $elementData['color'] ?? '#333333',
                'colorCmyk' => isset($elementData['colorCmyk']) ? $elementData['colorCmyk'] : null,
                'backgroundColor' => $elementData['backgroundColor'] ?? '#3498db',
                'backgroundColorCmyk' => isset($elementData['backgroundColorCmyk']) ? $elementData['backgroundColorCmyk'] : null,
                'borderColor' => $elementData['borderColor'] ?? '#2c3e50',
                'borderColorCmyk' => isset($elementData['borderColorCmyk']) ? $elementData['borderColorCmyk'] : null,
                'borderWidth' => $elementData['borderWidth'] ?? 1,
                'opacity' => $elementData['opacity'] ?? 1.00,
                'rotation' => $elementData['rotation'] ?? 0,
                'colorMode' => $elementData['colorMode'] ?? 'hex',
                'image_url' => $elementData['imageUrl'] ?? null,
            ]);
        }

        return response()->json([
            'message' => 'Template created successfully',
            'template' => $template->load('items')
        ], 201);
    }

    /**
     * Display the specified template.
     */
    public function show($id): JsonResponse
    {
        $template = Template::with(['items', 'client'])->findOrFail($id);

        // Transform template items to match frontend naming (image_url -> imageUrl)
        $elements = $template->items->map(function ($item) {
            $itemArray = $item->toArray();
            if (isset($itemArray['image_url'])) {
                $itemArray['imageUrl'] = $itemArray['image_url'];
                unset($itemArray['image_url']);
            }
            return $itemArray;
        });

        return response()->json([
            'id' => $template->id,
            'name' => $template->name,
            'width' => $template->width,
            'height' => $template->height,
            'client_id' => $template->client_id,
            'client' => $template->client,
            'layer_order' => $template->layer_order ?? [],
            'layer_visibility' => $template->layer_visibility ?? [],
            'elements' => $elements,
            'created_at' => $template->created_at,
            'updated_at' => $template->updated_at,
        ]);
    }

    /**
     * Update the specified template.
     */
    public function update(Request $request, $id): JsonResponse
    {
        $template = Template::findOrFail($id);

        $request->validate([
            'name' => 'required|string|max:255|unique:templates,name,' . $template->id,
            'width' => 'required|integer|min:1',
            'height' => 'required|integer|min:1',
            'client_id' => 'required|exists:clients,id',
            'elements' => 'required|array',
        ]);

        $template->update([
            'name' => $request->name,
            'width' => $request->width,
            'height' => $request->height,
            'client_id' => $request->client_id,
            'layer_order' => $request->input('layerOrder', []),
            'layer_visibility' => $request->input('layerVisibility', []),
        ]);

        // Delete existing items and recreate them
        $template->items()->delete();

        foreach ($request->elements as $elementData) {
            $template->items()->create([
                'name' => $elementData['name'],
                'type' => $elementData['type'],
                'x' => $elementData['x'],
                'y' => $elementData['y'],
                'width' => $elementData['width'],
                'height' => $elementData['height'],
                'text' => $elementData['text'] ?? null,
                'fontSize' => $elementData['fontSize'] ?? 14,
                'fontFamily' => $elementData['fontFamily'] ?? 'Arial',
                'textAlign' => $elementData['textAlign'] ?? 'left',
                'lineHeight' => $elementData['lineHeight'] ?? 18,
                'color' => $elementData['color'] ?? '#333333',
                'colorCmyk' => isset($elementData['colorCmyk']) ? $elementData['colorCmyk'] : null,
                'backgroundColor' => $elementData['backgroundColor'] ?? '#3498db',
                'backgroundColorCmyk' => isset($elementData['backgroundColorCmyk']) ? $elementData['backgroundColorCmyk'] : null,
                'borderColor' => $elementData['borderColor'] ?? '#2c3e50',
                'borderColorCmyk' => isset($elementData['borderColorCmyk']) ? $elementData['borderColorCmyk'] : null,
                'borderWidth' => $elementData['borderWidth'] ?? 1,
                'opacity' => $elementData['opacity'] ?? 1.00,
                'rotation' => $elementData['rotation'] ?? 0,
                'colorMode' => $elementData['colorMode'] ?? 'hex',
                'image_url' => $elementData['imageUrl'] ?? null,
            ]);
        }

        return response()->json([
            'message' => 'Template updated successfully',
            'template' => $template->load('items')
        ]);
    }

    /**
     * Remove the specified template.
     */
    public function destroy(Template $template): JsonResponse
    {
        $template->delete();

        return response()->json([
            'message' => 'Template deleted successfully'
        ]);
    }

    /**
     * Get application configuration for frontend.
     */
    public function config(): JsonResponse
    {
        return response()->json([
            'app_url' => config('app.url'),
            'api_base_url' => config('app.url') . '/api'
        ]);
    }
}
