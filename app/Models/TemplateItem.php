<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TemplateItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'template_id',
        'name',
        'type',
        'x',
        'y',
        'width',
        'height',
        'text',
        'fontSize',
        'fontFamily',
        'textAlign',
        'lineHeight',
        'color',
        'colorCmyk',
        'backgroundColor',
        'backgroundColorCmyk',
        'borderColor',
        'borderColorCmyk',
        'borderWidth',
        'opacity',
        'rotation',
        'colorMode',
        'image_url',
    ];

    protected $casts = [
        'colorCmyk' => 'array',
        'backgroundColorCmyk' => 'array',
        'borderColorCmyk' => 'array',
    ];

    public function template()
    {
        return $this->belongsTo(Template::class);
    }
}
