<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Template extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'width',
        'height',
        'layer_order',
        'layer_visibility',
        'client_id',
    ];

    protected $casts = [
        'layer_order' => 'array',
        'layer_visibility' => 'array',
    ];

    public function items()
    {
        return $this->hasMany(TemplateItem::class);
    }

    public function client()
    {
        return $this->belongsTo(Client::class);
    }
}
